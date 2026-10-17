/** Pure scene-address rules shared by reload recovery and the public wrapper. */
export const normalizeSceneId = id => id === 'projects-industry-continued' ? 'projects-industry' : id;

export function validSceneId(value, sceneIds) {
 const id = normalizeSceneId(value);
 return typeof id === 'string' && sceneIds.includes(id) ? id : null;
}

export function sceneFromHash(hash, sceneIds) {
 try { return validSceneId(decodeURIComponent(hash.replace(/^#/, '')), sceneIds); }
 catch { return null; }
}

export function initialSceneId(hash, storedScene, sceneIds) {
 // A deliberate link always wins over a previous reading position.
 return sceneFromHash(hash, sceneIds) || validSceneId(storedScene, sceneIds) || sceneIds[0];
}

export function navigationSceneFromMessage(event, { parentWindow, ownWindow, origin, sceneIds }) {
 if (parentWindow === ownWindow || event.source !== parentWindow || event.origin !== origin || event.data?.type !== 'RBB_NAVIGATE') return null;
 return validSceneId(event.data.scene, sceneIds);
}
