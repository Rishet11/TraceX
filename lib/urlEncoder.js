export function encodeShareData(data) {
  try {
    const jsonString = JSON.stringify(data);
    if (typeof window !== 'undefined') {
       return btoa(unescape(encodeURIComponent(jsonString))); // robust base64 encoding for unicode
    }
    return Buffer.from(jsonString).toString('base64');
  } catch (e) {
    console.error('Failed to encode data', e);
    return null;
  }
}

export function decodeShareData(encodedString) {
  try {
    if (typeof window !== 'undefined') {
       return JSON.parse(decodeURIComponent(escape(atob(encodedString))));
    }
    const jsonString = Buffer.from(encodedString, 'base64').toString('utf-8');
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to decode data', e);
    return null;
  }
}
