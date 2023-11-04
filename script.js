const IS_LOCAL = (window.location.origin === 'file://' || window.location.hostname.includes('localhost')),
	API_URL = 'https://api.minehut.com',
	MS_DAILY = 14400 * 1000,
	INTERVAL_LIVE_MODE = 5000, // 5 seconds
	INFO_MESSAGE = document.getElementById('timeLeft');
let name;

const liveModeCheckbox = document.getElementById('live-mode');
let liveModeEnabled = liveModeCheckbox.checked = localStorage.getItem('liveModeEnabled') ? localStorage.getItem('liveModeEnabled') === 'true' ? true : false : false;

liveModeCheckbox.addEventListener('change', (e) => {
	liveModeEnabled = liveModeCheckbox.checked;
	localStorage.setItem('liveModeEnabled', liveModeEnabled);
});	

setInterval(() => {
	if (liveModeEnabled) {
		checkTimeLeft(); 
	}
}, INTERVAL_LIVE_MODE);

function error(message) {
	INFO_MESSAGE.classList.add('text-red-500');
	INFO_MESSAGE.innerHTML = message;
}

function info(message) {
	INFO_MESSAGE.classList.remove('text-red-500');
	INFO_MESSAGE.innerHTML = message;
}

function padzero(n) {
	return ("" + n).padStart(2, '0');
}

document.getElementById('form').addEventListener('submit', (e) => {
	e.preventDefault();
	name = document.getElementById('server-name').value;
	checkTimeLeft();
});

async function sendRequest() {
	const searchParams = new URL(document.location).searchParams;
	
	if (IS_LOCAL && searchParams.get('localhostSendRequest') === null) { // for testing purposes
		const dayTime = dayjs(new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })));
		return { // all required fields
			"server_plan": "FREE",
			"daily_online_time": {
				[`${dayTime.date()}-${dayTime.month()}-${dayTime.year()}`]: searchParams.get('localhostDailyOnlineTime') * 1000 || MS_DAILY
			}
		};
	}
	
	return (await fetch(`${API_URL}/server/${name}?byName=true`).then((res) => res.json()))['server'];
}

async function checkTimeLeft() {
	if (name.trim() === '' || name.length === 0) {
		return error('You must enter a server name!');
	}
	
	try {
		const now = new Date();
		const dayTime = dayjs(now).set('hour', dayjs(now).hour() - 8); //convert now to PST
		const formatted = `${dayTime.date()}-${dayTime.month()}-${dayTime.year()}`;
		
		const req = await sendRequest();
		if (req['server_plan'] === 'FREE') {
			const timeSinceLastOnline = now.getTime() - req['last_online'];
			
			let ms = (req['daily_online_time'] && req['daily_online_time'][formatted]) ?? 0;
			if (req['online']) 
				ms += timeSinceLastOnline;
			if ((MS_DAILY - ms) <= 0) {
				let oneAMPSTReset = dayjs().utc().startOf('day').add(8, 'hour').tz();
				if (oneAMPSTReset.isBefore(dayjs())) oneAMPSTReset = oneAMPSTReset.add(1, 'day');
				
				const resetFormatted = oneAMPSTReset.format('hh:mm'), 
					resetHumanized = dayjs.duration(oneAMPSTReset.diff(dayjs())).humanize(true);
					
				info(`<span class="font-bold">${name}'s</span> daily time limit has run out. Daily limit resets at 
					<pre><code class="p-1 px-2 bg-zinc-700 rounded-sm">1 AM PST</code></pre> 
					that would be 
					<pre><code class="p-1 px-2 bg-zinc-700 rounded-sm" title="${resetFormatted}">${resetHumanized}</code></pre>
					in your timezone.`);
					
				return;
			}
			
			const duration = dayjs.duration(MS_DAILY - ms);
			const hours = padzero(duration.hours()), 
				minutes = padzero(duration.minutes()),
				seconds = padzero(duration.seconds());
			info(`<span class="font-bold">${name}</span> has ${hours}h ${minutes}m ${seconds}s left.`);
			return;
		}
		
		info('The daily limit only applies to FREE servers.');
	} catch (e) {
		error('Invalid server name!');
		console.error(e);
	}
}