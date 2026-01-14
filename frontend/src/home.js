import { api } from './api.js';
import './style.css';

// --- HOME PAGE LOGIC ---

let marketRefreshInterval = null;

async function initHome() {
    console.log("Initializing Home Page...");
    // Initial Fetch
    await fetchMarketOverview();

    // Start auto-refresh
    startAutoRefresh();
}

function startAutoRefresh() {
    if (!marketRefreshInterval) {
        marketRefreshInterval = setInterval(fetchMarketOverview, 30000); // 30 seconds
    }
}

async function fetchMarketOverview() {
    const data = await api.getMarketOverview();
    if (data && data.indices) {
        renderMarketOverview(data.indices);
    }
}

function renderMarketOverview(indices) {
    const container = document.getElementById('market-grid-container');
    if (!container) return;

    // Change container to flex row for horizontal strip look
    container.className = "flex flex-wrap gap-4 w-full";
    container.innerHTML = '';

    indices.forEach(idx => {
        const isUp = idx.change >= 0;
        const colorClass = isUp ? 'text-green-500' : 'text-red-500';
        const arrow = isUp ? '▲' : '▼';
        const sparklineSvg = generateSparkline(idx.history, isUp ? '#22c55e' : '#ef4444');

        const card = document.createElement('div');
        // Horizontal Strip Item Style
        card.className = "flex-1 min-w-[200px] bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-[#222] transition flex items-center justify-between";

        // MPA Navigation: Redirect to chart.html with symbol param
        card.onclick = () => {
            window.location.href = `chart.html?symbol=${idx.symbol}&name=${encodeURIComponent(idx.name)}`;
        };

        card.innerHTML = `
            <div class="flex flex-col">
                <span class="font-bold text-gray-200 text-sm">${idx.name}</span>
                <span class="text-xs text-gray-500">${idx.symbol}</span>
            </div>
            
            <div class="h-8 w-16 mx-2">
                 ${sparklineSvg}
            </div>

            <div class="text-right">
                <div class="font-bold text-white text-sm">${idx.price.toFixed(2)}</div>
                <div class="text-xs ${colorClass} font-semibold">
                    ${arrow} ${Math.abs(idx.change).toFixed(2)}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';

    const width = 100; // viewBox units
    const height = 40;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    // Map data to points
    const stepX = width / (data.length - 1);

    const points = data.map((val, i) => {
        const x = i * stepX;
        // Invert Y (SVG 0 is top)
        const normalized = (val - min) / (range || 1);
        const y = height - (normalized * height);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="w-full h-full overflow-visible">
            <polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
    `;
}

document.addEventListener('DOMContentLoaded', initHome);
