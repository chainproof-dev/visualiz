// ==================== UI Helpers ====================
export function showLoading(text) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('loading-text').textContent = text;
}

export function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

export function setProgress(percent) {
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

export function showError(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}
