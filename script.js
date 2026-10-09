// File: script.js

// Tautan Mirror Resmi Kartolo Datautama Surabaya (Debian 13.7.0 ISO Netinst)
let fileUrl = "https://kartolo.sby.datautama.net.id/debian-cd/13.7.0/amd64/iso-cd/debian-13.7.0-amd64-netinst.iso";

const STALL_THRESHOLD_MS = 500; // Jeda transfer > 500ms dianggap stall
const DROP_RATIO = 0.5;         // Penurunan laju > 50% dari interval sebelumnya

let isDownloading = false;

async function startDownload() {
    if (isDownloading) return;

    isDownloading = true;
    const btn = document.getElementById("btn-download");
    btn.innerText = "Mengukur Jaringan dari Mirror Kartolo Surabaya...";
    btn.disabled = true;

    // Reset UI
    document.getElementById("log-body").innerHTML = "";
    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("val-percent").innerText = "0%";
    document.getElementById("val-volume").innerText = "0.00 MB";
    document.getElementById("val-rate").innerText = "0.00 MB/s";
    document.getElementById("val-time").innerText = "0.0 s";

    // State Pengukuran
    const startTime = performance.now();
    let currentVolumeMB = 0;     // Volume kumulatif V (MB)
    let lastLogT = 0;            // Waktu log terakhir (s)
    let lastLogVolume = 0;       // Volume log terakhir (MB)
    let lastRate = 0;            // Laju interval sebelumnya (MB/s)
    let lastChunkTime = startTime;
    let maxGapMs = 0;            // Jeda terpanjang antar paket (ms)
    let nextLogTime = 10;        // Interval sampling per 10 detik
    let totalSizeMB = 0;

    // Titik Awal Wajib Panduan: t = 0
    addLogRow(0, 0, null, 0, "Awal pengukuran (koneksi dimulai, belum ada data)");

    // Sampling interval tepat setiap 10 detik (10000 ms)
    const sampler = setInterval(() => {
        const now = performance.now();
        const t = nextLogTime;
        logInterval(t, now);
        nextLogTime += 10;
    }, 10000);

    function logInterval(t, now, finalNote) {
        const dt = t - lastLogT;
        if (dt <= 0) return;
        const dV = currentVolumeMB - lastLogVolume;
        const rate = dV / dt; // Laju perubahan rata-rata interval ΔV/Δt (MB/s)

        // Hitung latensi maksimum pada interval berjalan
        const gap = Math.max(maxGapMs, now - lastChunkTime);
        const latensiMs = Math.round(gap);

        // Evaluasi Kondisi / Kejadian
        let kondisi;
        if (finalNote) {
            kondisi = finalNote;
        } else if (dV <= 0) {
            kondisi = "Gangguan: tidak ada data diterima";
        } else if (gap >= STALL_THRESHOLD_MS) {
            kondisi = `Jeda transfer tinggi (~${latensiMs} ms)`;
        } else if (lastRate > 0 && rate < lastRate * DROP_RATIO) {
            kondisi = "Laju turun >50% dibanding interval sebelumnya";
        } else {
            kondisi = "Normal (tidak ada gangguan)";
        }

        addLogRow(t, currentVolumeMB, rate, latensiMs, kondisi);

        lastLogT = t;
        lastLogVolume = currentVolumeMB;
        lastRate = rate;
        maxGapMs = 0;
    }

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Gagal mengambil stream file dari mirror Kartolo.");

        const contentLength = response.headers.get("content-length");
        if (contentLength) {
            totalSizeMB = parseInt(contentLength, 10) / (1024 * 1024);
        }

        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const now = performance.now();
            maxGapMs = Math.max(maxGapMs, now - lastChunkTime);
            lastChunkTime = now;

            currentVolumeMB += value.length / (1024 * 1024);

            // Update UI secara real-time
            const elapsed = (now - startTime) / 1000;
            document.getElementById("val-volume").innerText = currentVolumeMB.toFixed(2) + " MB";
            document.getElementById("val-time").innerText = elapsed.toFixed(1) + " s";
            document.getElementById("val-rate").innerText =
                (elapsed > 0 ? currentVolumeMB / elapsed : 0).toFixed(2) + " MB/s";

            if (totalSizeMB > 0) {
                const percentage = Math.min(100, (currentVolumeMB / totalSizeMB) * 100);
                document.getElementById("progress-bar").style.width = percentage.toFixed(1) + "%";
                document.getElementById("val-percent").innerText = percentage.toFixed(1) + "%";
            } else {
                document.getElementById("val-percent").innerText = "Mengukur...";
            }
        }

        // Pengunduhan Selesai
        clearInterval(sampler);
        const endT = (performance.now() - startTime) / 1000;
        if (endT - lastLogT > 0.05) {
            logInterval(Number(endT.toFixed(2)), performance.now(), "Pengujian selesai");
        }

        btn.innerText = "Uji Coba Selesai! Klik untuk Ulangi";
        btn.disabled = false;
        isDownloading = false;

    } catch (error) {
        clearInterval(sampler);
        console.error(error);
        alert("Gagal mengunduh dari mirror Kartolo Surabaya! Pastikan ekstensi 'Allow CORS' sudah terpasang dan AKTIF (berwarna hijau).");
        btn.innerText = "Mulai Unduh & Analisis";
        btn.disabled = false;
        isDownloading = false;
    }
}

function addLogRow(t, volumeMB, rate, latensi, kondisi) {
    const tbody = document.getElementById("log-body");
    const tr = document.createElement("tr");
    const cells = [
        t,
        volumeMB.toFixed(2),
        rate === null ? "-" : rate.toFixed(2),
        latensi === null ? "-" : latensi,
        kondisi
    ];
    cells.forEach((text, i) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (i === 4) td.className = "kondisi";
        tr.appendChild(td);
    });
    tbody.appendChild(tr);
}

// Salin tabel langsung ke clipboard (Tab-Separated) agar mudah di-paste ke Excel
function copyTable() {
    const rows = document.querySelectorAll("#log-table tr");
    const text = Array.from(rows)
        .map(r => Array.from(r.children).map(c => c.textContent.trim()).join("\t"))
        .join("\n");
    navigator.clipboard.writeText(text).then(
        () => alert("Tabel disalin. Tempel (Ctrl+V) ke Excel."),
        () => alert("Gagal menyalin. Salin tabel secara manual.")
    );
}