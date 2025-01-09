
function detectPlatform() {
    const userAgent = navigator.userAgent;
    if (/Windows/.test(userAgent)) return 'WINDOWS';
    if (/Macintosh|MacIntel/.test(userAgent)) return 'MAC';
    if (/Linux/.test(userAgent)) return 'LINUX';
    if (/Android/.test(userAgent)) return 'ANDROID';
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'IOS';
    return 'UNKNOWN';
}

function setupButtons() {
    const platform = detectPlatform();
    const downloadButton = document.querySelector('.download-linux .w-dropdown');

    let downloadLink = `/api/download?platform=${platform}`


    downloadButton.onclick = function() {
        window.location.href = downloadLink;
    };


}
setupButtons();