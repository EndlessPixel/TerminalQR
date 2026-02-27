
let currentMatrix = [];
let currentType = 'windows';
let previewWidth = 1;   // 网页预览宽度（默认1）
let terminalWidth = 2;  // 终端脚本宽度（默认2）
const MAX_CONTENT_LENGTH = 233; // QR Code 版本7容量限制

// 切换脚本类型
function switchType(type) {
    document.querySelectorAll('.tab button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(type)) btn.classList.add('active');
    });
    currentType = type;
    if (currentMatrix.length > 0) generate();
}

// 字符数统计
function updateCharCount() {
    const len = document.getElementById('text').value.length;
    document.getElementById('charCount').textContent =
        `字符数：${len} / 最大：${MAX_CONTENT_LENGTH}（QR Code 版本7）`;
    return len <= MAX_CONTENT_LENGTH;
}

// 生成二维码矩阵
function generateMatrix(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    const matrix = [];

    // 原始矩阵
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            row.push(qr.isDark(y, x) ? 1 : 0);
        }
        matrix.push(row);
    }

    // 白色外边框
    const bordered = [];
    const borderRow = new Array(size + 2).fill(2);
    bordered.push(borderRow);
    for (const row of matrix) {
        bordered.push([2, ...row, 2]);
    }
    bordered.push(borderRow);

    return bordered;
}

// 生成终端脚本用的ANSI字符串（用终端宽度）
function rowToTerminalAnsi(row) {
    let str = '';
    let lastColor = null;
    for (const bit of row) {
        let color;
        switch (bit) {
            case 0: color = '47'; break;  // 白色背景
            case 1: color = '40'; break;  // 黑色背景
            case 2: color = '47'; break;  // 白色外框
            default: color = '47';
        }
        if (color !== lastColor) {
            str += '\x1B[' + color + 'm';
            lastColor = color;
        }
        str += ' '.repeat(terminalWidth); // 终端用设置的宽度
    }
    return str + '\x1B[0m';
}

// 主生成函数
function generate() {
    const input = document.getElementById('text').value.trim();
    previewWidth = parseInt(document.getElementById('previewWidth').value) || 1;
    terminalWidth = parseInt(document.getElementById('terminalWidth').value) || 2;

    if (!input) {
        alert('请输入内容');
        return;
    }

    if (!updateCharCount()) {
        alert(`内容过长！请减少至 ${MAX_CONTENT_LENGTH} 字符以内`);
        return;
    }

    try {
        currentMatrix = generateMatrix(input);
        generateScript();       // 用terminalWidth生成脚本
        generatePreview();      // 用previewWidth生成预览
    } catch (e) {
        alert('生成失败：' + e.message);
    }
}

// 生成脚本文本
function generateScript() {
    let out = '';
    if (currentType === 'windows') {
        out += '@echo off\ncls\n';
        currentMatrix.forEach(row => {
            const ansi = rowToTerminalAnsi(row);
            out += `echo ${ansi}\n`;
        });
        out += 'echo.\npause >nul\n';
    } else if (currentType === 'powershell') {
        out += '$Host.UI.RawUI.WindowTitle = "Terminal QR Code"\nClear-Host\n';
        currentMatrix.forEach(row => {
            const ansi = rowToTerminalAnsi(row).replace(/\x1B/g, '`e');
            out += `Write-Host "${ansi}" -NoNewline\nWrite-Host ""\n`;
        });
        out += 'Write-Host ""\nRead-Host -Prompt "按 Enter 退出"\n';
    } else {
        currentMatrix.forEach(row => {
            const ansi = rowToTerminalAnsi(row);
            out += `echo -e "${ansi}"\n`;
        });
    }
    document.getElementById('codeOutput').innerHTML = `<pre class="token bash">${escapeHtml(out)}</pre>`;
    return out;
}

// 生成网页预览（独立宽度）
function generatePreview() {
    let previewText = '';
    currentMatrix.forEach(row => {
        let line = '';
        row.forEach(bit => {
            if (bit === 1) {
                // 黑色模块
                line += `<span style="background:#000;color:#000">${'█'.repeat(previewWidth)}</span>`;
            } else {
                // 白色模块/边框
                line += `<span style="background:#fff;color:#fff">${'█'.repeat(previewWidth)}</span>`;
            }
        });
        previewText += line + '\n';
    });
    document.getElementById('previewArea').innerHTML = `<pre>${previewText}</pre>`;
}

// 复制脚本
function copyScript() {
    const text = generateScript();
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ 脚本已复制到剪贴板！');
    }).catch(() => {
        alert('复制失败，请手动选中复制');
    });
}

// 下载脚本
function downloadScript() {
    let text = generateScript();
    let ext = '.txt';
    switch (currentType) {
        case 'windows': ext = '.bat'; break;
        case 'powershell': ext = '.ps1'; break;
        case 'linux': ext = '.sh'; break;
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-qr${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

// HTML转义
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 绑定事件
document.getElementById('text').addEventListener('input', updateCharCount);
