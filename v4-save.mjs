export function withTimeout(promise, milliseconds = 15000) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(Error('Tiempo de espera agotado. Vuelva a intentarlo.')),
                milliseconds,
            );
        }),
    ]).finally(() => clearTimeout(timer));
}

// The previous persistent anchor is retained until the new record is committed.
export async function persistSnapshot({
    session,
    referenceSpace,
    transform,
    snapshot,
    write,
    report = () => {},
    timeout = 15000,
}) {
    let anchor = null,
        handle = null,
        cancelled = false,
        committed = false;
    const cleanupHandle = (id) => {
        if (id) Promise.resolve(session.deletePersistentAnchor?.(id)).catch(() => {});
    };
    const ended = () => {
        cancelled = true;
    };
    session.addEventListener('end', ended);
    const current = () => {
        if (cancelled) throw Error('La sesión AR ha terminado.');
    };
    const withoutPosition = async () => {
        current();
        await write({ ...snapshot, anchorId: null });
        committed = true;
        return { anchor: null, handle: null };
    };
    try {
        current();
        if (
            typeof session.restorePersistentAnchor !== 'function' ||
            (session.enabledFeatures && !Array.from(session.enabledFeatures).includes('anchors'))
        ) {
            return await withoutPosition();
        }
        report('Creando el anclaje de la pared…');
        anchor = await withTimeout(
            new Promise((resolve, reject) =>
                session.requestAnimationFrame((_, frame) => {
                    try {
                        current();
                        if (!frame.createAnchor) {
                            resolve(null);
                            return;
                        }
                        Promise.resolve(frame.createAnchor(transform, referenceSpace)).then((value) => {
                            if (cancelled) {
                                value.delete();
                                reject(Error('Operación cancelada.'));
                            } else resolve(value);
                        }, reject);
                    } catch (error) {
                        reject(error);
                    }
                }),
            ),
            timeout,
        );
        current();
        if (!anchor?.requestPersistentHandle) {
            anchor?.delete();
            anchor = null;
            return await withoutPosition();
        }
        const handlePromise = anchor.requestPersistentHandle();
        handlePromise.then(
            (id) => {
                if (cancelled) cleanupHandle(id);
            },
            () => {},
        );
        handle = await withTimeout(handlePromise, timeout);
        current();
        report('Guardando la imagen y los ajustes en este visor…');
        await write({ ...snapshot, anchorId: handle });
        committed = true;
        return { anchor, handle };
    } catch (error) {
        if (error.name === 'NotSupportedError' && !cancelled) {
            cleanupHandle(handle);
            anchor?.delete();
            return await withoutPosition();
        }
        cancelled = true;
        if (!committed) {
            cleanupHandle(handle);
            anchor?.delete();
        }
        throw error;
    } finally {
        session.removeEventListener('end', ended);
    }
}
