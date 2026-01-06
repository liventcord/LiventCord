const proxyPanel = document.getElementById("statusPanel");

function interpolateColor(percent) {
  percent = Math.min(Math.max(percent, 0), 100);
  if (percent < 50) return `rgb(16, 185, 129)`;
  else if (percent < 80) return `rgb(251, 191, 36)`;
  else return `rgb(244, 63, 94)`;
}

function createBubble(percent, label, id) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const strokeColor = interpolateColor(percent);
  return `
    <div class="flex flex-col items-center space-y-2" id="bubble-${id}">
      <div class="circle-container">
        <svg width="80" height="80">
          <circle cx="40" cy="40" r="${radius}" stroke="rgba(255,255,255,0.1)" stroke-width="6" fill="none" />
          <circle class="animated-circle" data-id="${id}" cx="40" cy="40" r="${radius}" 
            stroke="${strokeColor}" stroke-width="6" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" />
        </svg>
        <div class="circle-text" data-label="${id}">${percent}%</div>
      </div>
      <div class="text-slate-300 text-xs font-medium">${label}</div>
    </div>
  `;
}

function updateBubble(id, percent) {
  percent = Math.min(Math.max(percent || 0, 0), 100);
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
    ? "backdrop-blur-md bg-rose-950/40 border border-rose-500/50 p-6 rounded-2xl mb-6 shadow-2xl hover:shadow-rose-500/20 transition-all duration-300"
    : "backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-2xl mb-6 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300";
}

function formatUptime(uptime) {
  if (!uptime || typeof uptime !== "string") return "N/A";
  return uptime.split(".")[0];
}

function generateFilesServed(data) {
  const isProxy = data.service.toLowerCase().includes("proxy");
  const isLiventCord = data.service === "LiventCord";

  let res =
    isProxy || isLiventCord
      ? `<p class="text-slate-300"><span class="font-semibold text-white">Files Served:</span> <span data-field="filesServed">${data.servedFilesSinceStartup ?? "0"}</span></p>`
      : `<p class="text-slate-300"><span class="font-semibold text-white">Users Connected:</span> <span data-field="usersCount">${data.usersCount ?? "0"}</span></p>`;

  if (isLiventCord) {
    res += `<p class="text-slate-300"><span class="font-semibold text-white">Total Requests:</span> <span data-field="totalRequests">${data.totalRequestsServed ?? "0"}</span></p>`;
  }

  return res;
}

function renderServiceInfo(data) {
  return `
    <div class="space-y-2 text-sm">
      <p class="text-slate-300"><span class="font-semibold text-white">Name:</span> <span data-field="name">${data.service ?? "N/A"}</span></p>
      <p class="text-slate-300"><span class="font-semibold text-white">Status:</span> 
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" data-field="status">${data.status ?? "N/A"}</span>
      </p>
      <p class="text-slate-300"><span class="font-semibold text-white">Uptime:</span> <span data-field="uptime">${formatUptime(data.uptime)}</span></p>
      ${generateFilesServed(data)}
    </div>
  `;
}

function renderSystemInfo(data, uniqueId) {
  const memPercent = Math.round(data.memory?.system?.usedPercent || 0);
  const cpuPercent = Math.round(data.cpuUsagePercent || 0);
  const isLiventCord = data.service === "LiventCord";
  const gcCount = data.memory?.numGc ?? data.memory?.num_gc ?? 0;

  return `
    <div class="backdrop-blur-sm bg-white/5 p-5 rounded-xl border border-white/10 shadow-lg">
      <h3 class="text-base font-semibold mb-4 text-indigo-300 flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
        </svg>
        System Resources
      </h3>
      <div class="flex justify-around mb-5">
        ${createBubble(cpuPercent, "CPU", `${uniqueId}-cpu`)}
        ${createBubble(memPercent, "Memory", `${uniqueId}-mem`)}
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <p class="text-slate-300"><span class="font-semibold text-white">OS:</span> <span data-field="os">${data.memory?.os ?? "N/A"}</span></p>
        ${isLiventCord ? `<p class="text-slate-300"><span class="font-semibold text-white">CPU Cores:</span> <span data-field="cpuCores">${data.cpuCores ?? "N/A"}</span></p>` : `<p class="text-slate-300"><span class="font-semibold text-white">Sys:</span> <span data-field="goSys">${data.memory?.go_sys ?? "N/A"}</span></p>`}
        <p class="text-slate-300"><span class="font-semibold text-white">GC Count:</span> <span data-field="gcCount">${gcCount}</span></p>
        ${isLiventCord ? `<p class="text-slate-300"><span class="font-semibold text-white">DB Size:</span> <span data-field="dbSize">${data.usedDbSize ?? "N/A"}</span> GB</p>` : `<p class="text-slate-300"><span class="font-semibold text-white">Routines:</span> <span data-field="goroutines">${data.goroutines ?? "N/A"}</span></p>`}
        <p class="col-span-2 text-slate-300"><span class="font-semibold text-white">Memory:</span> <span data-field="memoryUsed">${data.memory?.system?.used ?? "N/A"}</span> / <span data-field="memoryTotal">${data.memory?.system?.total ?? "N/A"}</span></p>
      </div>
    </div>
  `;
}

function renderStorageInfo(data, uniqueId) {
  const isLiventCord = data.service === "LiventCord";
  const dbUsed = data.usedDbSize ?? 0;
  const dbLimit = 5;
  const dbPercent = Math.round((dbUsed / dbLimit) * 100);

  const storageUsed = Math.round(
    ((data.storageStatus?.folderSizeGB ?? 0) /
      (data.storageStatus?.storageLimitGB || 1)) *
      100,
  );

  const limitReached = data.storageStatus?.limitReached ? "Yes" : "No";

  return `
    <div class="backdrop-blur-sm bg-white/5 p-5 rounded-xl border border-white/10 shadow-lg">
      <h3 class="text-base font-semibold mb-4 text-emerald-300 flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
        </svg>
        ${isLiventCord ? "Database" : "Storage"}
      </h3>
      <div class="flex justify-center mb-5">
        ${isLiventCord ? createBubble(dbPercent, "DB Size", `${uniqueId}-db`) : createBubble(storageUsed, "Storage", `${uniqueId}-storage`)}
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm">
        ${isLiventCord ? `<p class="text-slate-300"><span class="font-semibold text-white">Limit:</span> <span data-field="dbLimit">${dbLimit} GB</span></p>` : `<p class="text-slate-300"><span class="font-semibold text-white">Limit:</span> <span data-field="storageLimit">${data.storageStatus?.storageLimitGB ?? "N/A"} GB</span></p>`}
        ${isLiventCord ? `<p class="text-slate-300"><span class="font-semibold text-white">Used:</span> <span data-field="dbUsed">${dbUsed}</span> GB</p>` : `<p class="text-slate-300"><span class="font-semibold text-white">Used:</span> <span data-field="storageUsed">${data.storageStatus?.folderSizeGB?.toFixed(2) ?? "N/A"}</span> GB</p>`}
        ${!isLiventCord ? `<p class="text-slate-300"><span class="font-semibold text-white">Limit Reached:</span> <span data-field="limitReached">${limitReached}</span></p>` : ""}
      </div>
    </div>
  `;
}

function renderServicePanel(data, url, uniqueId) {
  const isCritical =
    !data || data.isDown || data.memory?.system?.usedPercent === undefined;
  const panelClass = getPanelClass(isCritical);
  const downNotice = data.isDown
    ? `<span class="text-rose-400 text-sm">(DOWN ${data.lastOnline ? `— Last: ${formatLastOnline(data.lastOnline)}` : ""})</span>`
    : "";

  const heading = isCritical
    ? `<h2 class="text-xl font-bold mb-4 flex items-center gap-3 text-rose-300">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
         </svg>
         ${url} ${downNotice}
       </h2>`
    : `<h2 class="text-xl font-bold mb-4 flex items-center gap-3 text-indigo-200">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
         </svg>
         ${url}
       </h2>`;

  return `
    <div class="${panelClass}" id="panel-${uniqueId}">
      <div class="grid md:grid-cols-3 gap-6">
        <div class="md:col-span-1">
          ${heading}
          ${renderServiceInfo(data)}
        </div>
        <div class="md:col-span-2 grid md:grid-cols-2 gap-6">
          ${renderSystemInfo(data, uniqueId)}
          ${data.service === "WS Api" ? "" : renderStorageInfo(data, uniqueId)}
        </div>
      </div>
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
      memory: { system: { usedPercent: 0, used: "0", total: "0" } },
      cpuUsagePercent: 0,
    };
  }
  const memory = rawData.memory || {};
  const systemMem = memory.system || {};

  return {
    ...rawData,
    isDown: service.isDown ?? false,
    url: service.url,
    lastOnline: service.lastOnline,
    cpuUsagePercent:
      typeof rawData.cpuUsagePercent === "string"
        ? parseFloat(rawData.cpuUsagePercent.replace("%", ""))
        : rawData.cpuUsagePercent,
    memory: {
      system: {
        usedPercent:
          systemMem.usedPercent !== undefined
            ? parseFloat(systemMem.usedPercent)
            : undefined,
        used: systemMem.used ?? undefined,
        total: systemMem.total ?? undefined,
      },
      os: memory.os ?? rawData.os ?? undefined,
      numGc: memory.numGc ?? memory.num_gc ?? undefined,
      go_sys: memory.go_sys ?? memory.GoAlloc ?? undefined,
    },
    cpuCores: rawData.cpuCores ?? undefined,
    usedDbSize: rawData.usedDbSize ?? undefined,
    storageStatus: rawData.storageStatus ?? undefined,
    servedFilesSinceStartup: rawData.servedFilesSinceStartup ?? undefined,
    totalRequestsServed: rawData.totalRequestsServed ?? undefined,
    usersCount: rawData.usersCount ?? undefined,
    goroutines: rawData.goroutines ?? undefined,
    service: rawData.service ?? "Unknown",
    status: rawData.status ?? "Unknown",
  };
}

function updateServicePanel(normalized, uniqueId) {
  const panel = document.getElementById(`panel-${uniqueId}`);
  if (!panel) return;

  const cpuPercent = Math.round(normalized.cpuUsagePercent || 0);
  const memPercent = Math.round(normalized.memory?.system?.usedPercent || 0);

  updateBubble(`${uniqueId}-cpu`, cpuPercent);
  updateBubble(`${uniqueId}-mem`, memPercent);

  if (normalized.service === "LiventCord") {
    const dbPercent = Math.round(((normalized.usedDbSize ?? 0) / 5) * 100);
    updateBubble(`${uniqueId}-db`, dbPercent);
  } else if (normalized.storageStatus) {
    const storagePercent = Math.round(
      ((normalized.storageStatus.folderSizeGB ?? 0) /
        (normalized.storageStatus.storageLimitGB || 1)) *
        100,
    );
    updateBubble(`${uniqueId}-storage`, storagePercent);
  }

  let el;

  el = panel.querySelector('[data-field="name"]');
  if (el) el.textContent = normalized.service ?? "N/A";
  el = panel.querySelector('[data-field="status"]');
  if (el) el.textContent = normalized.status ?? "N/A";
  el = panel.querySelector('[data-field="uptime"]');
  if (el) el.textContent = formatUptime(normalized.uptime);
  el = panel.querySelector('[data-field="filesServed"]');
  if (el) el.textContent = normalized.servedFilesSinceStartup ?? "0";
  el = panel.querySelector('[data-field="usersCount"]');
  if (el) el.textContent = normalized.usersCount ?? "0";
  el = panel.querySelector('[data-field="totalRequests"]');
  if (el) el.textContent = normalized.totalRequestsServed ?? "0";
  el = panel.querySelector('[data-field="os"]');
  if (el) el.textContent = normalized.memory?.os ?? "N/A";
  el = panel.querySelector('[data-field="cpuCores"]');
  if (el) el.textContent = normalized.cpuCores ?? "N/A";
  el = panel.querySelector('[data-field="goSys"]');
  if (el) el.textContent = normalized.memory?.go_sys ?? "N/A";
  el = panel.querySelector('[data-field="gcCount"]');
  if (el)
    el.textContent = normalized.memory?.numGc ?? normalized.memory?.num_gc ?? 0;
  el = panel.querySelector('[data-field="goroutines"]');
  if (el) el.textContent = normalized.goroutines ?? "N/A";
  el = panel.querySelector('[data-field="memoryUsed"]');
  if (el) el.textContent = normalized.memory?.system?.used ?? "N/A";
  el = panel.querySelector('[data-field="memoryTotal"]');
  if (el) el.textContent = normalized.memory?.system?.total ?? "N/A";
  el = panel.querySelector('[data-field="dbSize"]');
  if (el) el.textContent = normalized.usedDbSize ?? "N/A";
  el = panel.querySelector('[data-field="dbUsed"]');
  if (el) el.textContent = normalized.usedDbSize ?? "N/A";
  el = panel.querySelector('[data-field="dbLimit"]');
  if (el) el.textContent = 5;
  el = panel.querySelector('[data-field="storageUsed"]');
  if (el)
    el.textContent =
      normalized.storageStatus?.folderSizeGB?.toFixed(2) ?? "N/A";
  el = panel.querySelector('[data-field="storageLimit"]');
  if (el) el.textContent = normalized.storageStatus?.storageLimitGB ?? "N/A";
  el = panel.querySelector('[data-field="limitReached"]');
  if (el)
    el.textContent = normalized.storageStatus?.limitReached ? "Yes" : "No";
}

async function fetchStatus() {
  try {
    const res = await fetch(`/health`);
    if (!res.ok) {
      proxyPanel.innerHTML = `<div class="backdrop-blur-md bg-rose-950/40 border border-rose-500/50 p-6 rounded-2xl text-rose-300 text-center">⚠️ Server responded with status ${res.status}</div>`;
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
        updateServicePanel(normalized, uniqueId);
      }
    });

    document.querySelectorAll('[id^="panel-"]').forEach((panel) => {
      const id = panel.id.replace("panel-", "");
      if (!existingPanels.has(id)) panel.remove();
    });
  } catch (err) {
    proxyPanel.innerHTML = `<div class="backdrop-blur-md bg-rose-950/40 border border-rose-500/50 p-6 rounded-2xl text-rose-300 text-center">⚠️ Error: ${err.message}</div>`;
  }
}

fetchStatus();
setInterval(fetchStatus, 1000);
