const proxyPanel = document.getElementById("statusPanel");
const liventcord = "LiventCord";
const wsapi = "WS Api";
const proxyApi = "Proxy Api";

function interpolateColor(percent) {
  percent = Math.min(Math.max(percent, 0), 100);
  const hue = 120 - (120 * percent) / 100;
  return `hsl(${hue}, 100%, 50%)`;
}

function createBubble(percent, label, id) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const strokeColor = interpolateColor(percent);

  return `
    <div class="flex flex-col items-center space-y-1" id="bubble-${id}">
      <div class="circle-container">
        <svg width="80" height="80">
          <circle cx="40" cy="40" r="${radius}" stroke="#0ff2" stroke-width="8" fill="none" />
          <circle class="animated-circle" data-id="${id}" cx="40" cy="40" r="${radius}" 
            stroke="${strokeColor}" stroke-width="8" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" />
        </svg>
        <div class="circle-text" data-label="${id}">${percent}%</div>
      </div>
      <div class="text-cyan-400 text-xs font-semibold">${label}</div>
    </div>
  `;
}

function updateBubble(id, percent) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const strokeColor = interpolateColor(percent);

  const circle = document.querySelector(`.animated-circle[data-id="${id}"]`);
  const label = document.querySelector(`.circle-text[data-label="${id}"]`);
  if (circle && label) {
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = strokeColor;
    label.textContent = percent + "%";
  }
}

function getPanelClass(isCritical) {
  return isCritical
    ? "critical-panel p-4 md:p-5 rounded-lg mb-6 grid md:grid-cols-3 gap-4 items-start"
    : "bg-cyan-900 text-cyan-400 p-4 md:p-5 rounded-lg mb-6 grid md:grid-cols-3 gap-4 items-start";
}

function formatUptime(uptime) {
  if (!uptime || typeof uptime !== "string") return "N/A";
  return uptime.split(".")[0];
}

function generateFilesServed(data) {
  let res =
    data.service === proxyApi || data.service === liventcord
      ? `<p><span class="font-semibold">Files Served:</span> ${data.servedFilesSinceStartup ?? "0"}</p>`
      : `<p><span class="font-semibold">Users Connected:</span> ${data.usersCount ?? "0"}</p>`;

  if (data.service === liventcord) {
    res += `<p><span class="font-semibold">Total Requests Responded:</span> ${data.totalRequestsServed ?? "0"}</p>`;
  }

  return res;
}

function renderServiceInfo(data) {
  return `
    <div class="space-y-1 text-sm">
      <p><span class="font-semibold">Name:</span> ${data.service ?? "N/A"}</p>
      <p><span class="font-semibold">Uptime:</span> ${formatUptime(data.uptime)}</p>
      ${generateFilesServed(data)}
    </div>
  `;
}

function renderSystemInfo(data, uniqueId) {
  const memPercent = Math.round(data.memory?.system?.usedPercent || 0);
  const cpuPercent = Math.round(data.cpuUsagePercent || 0);
  const isLiventCord = data.service === liventcord;

  const bubbles = `
    <div class="flex justify-around mb-2">
      ${createBubble(cpuPercent, "CPU", `${uniqueId}-cpu`)}
      ${createBubble(memPercent, "Memory", `${uniqueId}-mem`)}
    </div>
  `;

  const additional = isLiventCord
    ? `
    <p><span class="font-semibold">OS:</span> ${data.memory?.os ?? "N/A"}</p>
    <p><span class="font-semibold">CPU Cores:</span> ${data.cpuCores ?? "N/A"}</p>
    <p><span class="font-semibold">GC Count:</span> ${data.memory?.numGc ?? "N/A"}</p>
    <p><span class="font-semibold">Used DB Size:</span> ${data.usedDbSize ?? "N/A"} GB</p>
    `
    : `
    <p><span class="font-semibold">OS:</span> ${data.os ?? "N/A"}</p>
    <p><span class="font-semibold">Sys:</span> ${data.memory?.go_sys ?? "N/A"}</p>
    <p><span class="font-semibold">Go Routines:</span> ${data.goroutines ?? "N/A"}</p>
    <p><span class="font-semibold">GC Count:</span> ${data.memory?.num_gc ?? "N/A"}</p>
    `;

  return `
    <div class="space-y-2">
      <h3 class="text-base font-bold mb-2">🧠 System</h3>
      ${bubbles}
      ${additional}
      <p><span class="font-semibold">Used:</span> ${data.memory?.system?.used ?? "N/A"} / ${data.memory?.system?.total ?? "N/A"}</p>
    </div>
  `;
}

function renderStorageInfo(data, uniqueId) {
  if (data.service === liventcord) {
    const dbUsed = data.usedDbSize ?? 0;
    const dbLimit = 5;
    const dbPercent = Math.round((dbUsed / dbLimit) * 100);
    return `
      <div>
        <h3 class="text-sm font-bold mb-2">💾 Database</h3>
        <div class="flex justify-center mb-2">${createBubble(dbPercent, "DB Size", `${uniqueId}-db`)}</div>
        <div class="text-sm space-y-1">
          <p><span class="font-semibold">Limit:</span> ${dbLimit} GB</p>
          <p><span class="font-semibold">Used:</span> ${dbUsed} GB</p>
        </div>
      </div>
    `;
  }

  const storageUsed = Math.round(
    ((data.storageStatus?.folderSizeGB ?? 0) /
      (data.storageStatus?.storageLimitGB || 1)) *
      100,
  );

  return `
    <div>
      <h3 class="text-sm font-bold mb-2">💾 Storage</h3>
      <div class="flex justify-center mb-2">${createBubble(storageUsed, "Storage", `${uniqueId}-storage`)}</div>
      <div class="text-sm space-y-1">
        <p><span class="font-semibold">Limit:</span> ${data.storageStatus?.storageLimitGB ?? "N/A"} GB</p>
        <p><span class="font-semibold">Used:</span> ${data.storageStatus?.folderSizeGB?.toFixed(2) ?? "N/A"} GB</p>
      </div>
    </div>
  `;
}

function renderServicePanel(data, url, uniqueId) {
  const isCritical =
    !data || data.isDown || data.memory?.system?.usedPercent === undefined;
  const panelClass = getPanelClass(isCritical);
  const downNotice = data.isDown
    ? `(DOWN ${data.lastOnline ? `, Last Online: ${formatLastOnline(data.lastOnline)}` : ""})`
    : "";

  const heading = isCritical
    ? `<h2 class="text-base font-bold uppercase tracking-wide mb-2 flex items-center gap-2 text-red-100">⚠️ ${url} ${downNotice}</h2>`
    : `<h2 class="text-base neon-text mb-2">🛰️ ${url}</h2>`;

  return `
    <div class="${panelClass}" id="panel-${uniqueId}">
      <div>${heading}${renderServiceInfo(data)}</div>
      ${renderSystemInfo(data, uniqueId)}
      ${data.service === wsapi ? "" : renderStorageInfo(data, uniqueId)}
    </div>
  `;
}

function formatLastOnline(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function normalizeServiceData(service) {
  const rawData = service.data?.data ?? service.data;

  if (!rawData) {
    return {
      service: "Unknown",
      status: "Unknown",
      isDown: true,
      url: service.url,
      lastOnline: service.lastOnline,
      memory: { system: { usedPercent: 0 } },
      cpuUsagePercent: 0,
    };
  }

  const normalized = {
    ...rawData,
    isDown: service.isDown ?? false,
    url: service.url,
    lastOnline: service.lastOnline,
  };

  if (typeof normalized.cpuUsagePercent === "string") {
    normalized.cpuUsagePercent = parseFloat(
      normalized.cpuUsagePercent.replace("%", ""),
    );
  }

  if (!normalized.memory?.num_gc && normalized.memory?.numGc !== undefined) {
    normalized.memory.num_gc = normalized.memory.numGc;
  }

  if (!normalized.memory?.go_sys && normalized.memory?.GoAlloc !== undefined) {
    normalized.memory.go_sys = normalized.memory.GoAlloc;
  }

  return normalized;
}

async function fetchStatus() {
  try {
    const res = await fetch(`/health`);
    if (!res.ok) {
      proxyPanel.innerHTML = `<div class="text-red-500 text-center">⚠️ Server responded with status ${res.status}</div>`;
      return;
    }

    const data = await res.json();
    const existingPanels = new Set();

    data.services.forEach((service, index) => {
      const normalized = normalizeServiceData(service);
      const uniqueId = `${normalized.service}-${index}`;
      existingPanels.add(uniqueId);

      const panelId = `panel-${uniqueId}`;
      let panel = document.getElementById(panelId);

      if (!panel) {
        const fetchingText = proxyPanel.querySelector(".text-center");
        if (fetchingText) fetchingText.remove();
        proxyPanel.insertAdjacentHTML(
          "beforeend",
          renderServicePanel(normalized, service.url, uniqueId),
        );
      } else {
        const cpuPercent = Math.round(normalized.cpuUsagePercent || 0);
        const memPercent = Math.round(
          normalized.memory?.system?.usedPercent || 0,
        );

        updateBubble(`${uniqueId}-cpu`, cpuPercent);
        updateBubble(`${uniqueId}-mem`, memPercent);

        if (normalized.service === liventcord) {
          const dbPercent = Math.round(
            ((normalized.usedDbSize ?? 0) / 5) * 100,
          );
          updateBubble(`${uniqueId}-db`, dbPercent);
        } else if (normalized.storageStatus) {
          const storagePercent = Math.round(
            ((normalized.storageStatus.folderSizeGB ?? 0) /
              (normalized.storageStatus.storageLimitGB || 1)) *
              100,
          );
          updateBubble(`${uniqueId}-storage`, storagePercent);
        }
      }
    });

    document.querySelectorAll('[id^="panel-"]').forEach((panel) => {
      const id = panel.id.replace("panel-", "");
      if (!existingPanels.has(id)) panel.remove();
    });
  } catch (err) {
    proxyPanel.innerHTML = `<div class="text-red-500 text-center">⚠️ Error: ${err.message}</div>`;
  }
}

fetchStatus();
setInterval(fetchStatus, 10000);
