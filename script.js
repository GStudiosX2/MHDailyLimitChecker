const API_URL = "https://api.minehut.com",
  ICON_REPO = "https://minehut-server-icons-live.s3.us-west-2.amazonaws.com",
  MS_DAILY = 14400 * 1000,
  INTERVAL_LIVE_MODE = 5000, // 5 seconds
  INFO_MESSAGE = document.getElementById("timeLeft"),
  RECENTS = document.getElementById("recent");

let name;
let recents = localStorage.getItem("RECENT_SERVERS")
  ? [
      ...new Set(
        JSON.parse(localStorage.getItem("RECENT_SERVERS")).map((v) =>
          v.toLowerCase().trim(),
        ),
      ),
    ].filter((v) => !!v)
  : [];
let recentCache = {};

async function updateRecents() {
  if (recents.length > 3) {
    recents.shift();
  }

  let child = RECENTS.firstChild;
  while (child) {
    child.remove();
    child = RECENTS.firstChild;
  }

  if (recents.length === 0) {
    RECENTS.appendChild(document.createTextNode("None"));
    return;
  }

  for (const recent of recents) {
    const data = recentCache[recent] ?? (await checkTimeLeft(recent, false));
    recentCache[recent] = data;
    if (data.server) {
      const server = data.server;
      const timeLeft = data.duration
        ? `${data.hours}h ${data.minutes}m ${data.seconds}s`
        : data.resetHumanized;
      const recentDiv = document.createElement("div");
      recentDiv.className =
        "p-2 rounded-xl bg-zinc-900 w-full flex flex-row justify-between";
      const serverName = document.createElement("div");
      serverName.className = "flex flex-row gap-2";
      const pngImage = document.createElement("img");
      pngImage.className = "w-8 h-8";
      pngImage.src = server.icon
        ? `${ICON_REPO}/${server.icon}.png`
        : `${ICON_REPO}/OAK_SIGN.png`;
      serverName.appendChild(pngImage);
      serverName.appendChild(document.createTextNode(server.name));
      recentDiv.appendChild(serverName);
      const serverTimeLeft = document.createElement("p");
      serverTimeLeft.textContent = timeLeft;
      recentDiv.appendChild(serverTimeLeft);
      RECENTS.appendChild(recentDiv);
    }
  }

  localStorage.setItem("RECENT_SERVERS", JSON.stringify(recents));
}

document.getElementById("clearRecent").addEventListener("click", () => {
  recents = [];
  updateRecents();
});

const liveModeCheckbox = document.getElementById("live-mode");
let liveModeEnabled = (liveModeCheckbox.checked = localStorage.getItem(
  "liveModeEnabled",
)
  ? localStorage.getItem("liveModeEnabled") === "true"
    ? true
    : false
  : false);

liveModeCheckbox.addEventListener("change", (e) => {
  liveModeEnabled = liveModeCheckbox.checked;
  localStorage.setItem("liveModeEnabled", liveModeEnabled);
});

updateRecents();

setInterval(() => {
  if (liveModeEnabled) {
    checkTimeLeft(name);
  }
}, INTERVAL_LIVE_MODE);

function error(message) {
  INFO_MESSAGE.classList.add("text-red-500");
  INFO_MESSAGE.innerHTML = message;
}

function info(message) {
  INFO_MESSAGE.classList.remove("text-red-500");
  INFO_MESSAGE.innerHTML = message;
}

function padzero(n) {
  return ("" + n).padStart(2, "0");
}

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  name = document.getElementById("server-name").value;
  const name_lower = name.toLowerCase();
  recentCache[name_lower] = await checkTimeLeft(name);
  if (recents.length > 3) {
    recents.shift();
  }
  if (!recents.includes(name_lower) && recentCache[name_lower]) {
    recents.push(name_lower);
    await updateRecents();
  }
});

async function sendRequest(name) {
  const server = (
    await fetch(`${API_URL}/server/${name}?byName=true`).then((res) =>
      res.json(),
    )
  )["server"];
  return server;
}

async function checkTimeLeft(name, log = true) {
  if (name.trim() === "" || name.length === 0) {
    return log && error("You must enter a server name!");
  }

  try {
    const now = new Date();
    const dayTime = dayjs(now).set("hour", dayjs(now).hour() - 8); //convert now to PST
    const formatted = `${dayTime.date()}-${dayTime.month()}-${dayTime.year()}`;

    const req = await sendRequest(name);
    if (req["server_plan"] === "FREE") {
      const timeSinceLastOnline = now.getTime() - req["last_online"];
      let ms =
        (req["daily_online_time"] && req["daily_online_time"][formatted]) ?? 0;
      if (req["online"]) ms += timeSinceLastOnline;
      if (MS_DAILY - ms <= 0) {
        let oneAMPSTReset = dayjs().utc().startOf("day").add(8, "hour").tz();
        if (oneAMPSTReset.isBefore(dayjs()))
          oneAMPSTReset = oneAMPSTReset.add(1, "day");

        const resetFormatted = oneAMPSTReset.format("hh:mm"),
          resetHumanized = dayjs
            .duration(oneAMPSTReset.diff(dayjs()))
            .humanize(true);

        log &&
          info(`<span class="font-bold">${name}'s</span> daily time limit has run out. Daily limit resets at 
					<pre><code class="p-1 px-2 bg-zinc-700 rounded-sm">1 AM PST</code></pre> 
					that would be 
					<pre><code class="p-1 px-2 bg-zinc-700 rounded-sm" title="${resetFormatted}">${resetHumanized}</code></pre>
					in your timezone.`);

        return {
          server: req,
          reset: oneAMPSTReset,
          resetFormatted,
          resetHumanized,
        };
      }

      const duration = dayjs.duration(MS_DAILY - ms);
      const hours = padzero(duration.hours()),
        minutes = padzero(duration.minutes()),
        seconds = padzero(duration.seconds());
      log &&
        info(
          `<span class="font-bold">${name}</span> has ${hours}h ${minutes}m ${seconds}s left.`,
        );
      return { server: req, duration, hours, minutes, seconds };
    }

    log && info("The daily limit only applies to FREE servers.");
  } catch (e) {
    log && error("Invalid server name!");
    console.error(e);
  }

  return null;
}
