const TIME_ZONE = 'Africa/Libreville';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function parseConfig(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function findNextOpening(config, now) {
  const today = localParts(now);
  const todayIndex = WEEKDAYS.indexOf(today.weekday);
  const todayMinutes = Number(today.hour) * 60 + Number(today.minute);

  for (let offset = 0; offset <= 7; offset += 1) {
    const dayIndex = (todayIndex + offset) % 7;
    const day = config.weekly?.[WEEKDAYS[dayIndex]];
    if (!day?.active || !/^\d{2}:\d{2}$/.test(day.open_time || '')) continue;
    if (offset === 0 && todayMinutes < timeToMinutes(day.open_time)) {
      return new Date(`${today.year}-${today.month}-${today.day}T${day.open_time}:00+01:00`);
    }
    if (offset > 0) {
      const base = new Date(`${today.year}-${today.month}-${today.day}T12:00:00+01:00`);
      base.setUTCDate(base.getUTCDate() + offset);
      const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(base);
      const dateValues = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
      return new Date(`${dateValues.year}-${dateValues.month}-${dateValues.day}T${day.open_time}:00+01:00`);
    }
  }
  return null;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getOnlineOrderingState(rawConfig, now = new Date()) {
  const parsedConfig = parseConfig(rawConfig);
  const config = parsedConfig || {};
  // A present but malformed persisted value must fail closed; treating it as
  // "not configured" would silently bypass the restaurant's ordering hours.
  const configured = rawConfig !== undefined && rawConfig !== null && rawConfig !== ''
    ? !parsedConfig || Boolean(config.weekly && WEEKDAYS.some(dayName => Object.hasOwn(config.weekly, dayName)))
    : false;
  const enabled = config.enabled !== false;
  const local = localParts(now);
  const day = config.weekly?.[local.weekday];
  const weekdayIndex = WEEKDAYS.indexOf(local.weekday);
  const previousDay = config.weekly?.[WEEKDAYS[(weekdayIndex + WEEKDAYS.length - 1) % WEEKDAYS.length]];
  const currentMinutes = Number(local.hour) * 60 + Number(local.minute);
  const validDay = day?.active && /^\d{2}:\d{2}$/.test(day.open_time || '') && /^\d{2}:\d{2}$/.test(day.last_order_time || '');
  const openMinutes = validDay ? timeToMinutes(day.open_time) : 0;
  const lastOrderMinutes = validDay ? timeToMinutes(day.last_order_time) : 0;
  const previousDayOvernight = previousDay?.active
    && /^\d{2}:\d{2}$/.test(previousDay.open_time || '')
    && /^\d{2}:\d{2}$/.test(previousDay.last_order_time || '')
    && timeToMinutes(previousDay.open_time) > timeToMinutes(previousDay.last_order_time)
    && currentMinutes <= timeToMinutes(previousDay.last_order_time);
  const sameDayWindow = validDay && openMinutes < lastOrderMinutes && currentMinutes >= openMinutes && currentMinutes <= lastOrderMinutes;
  const overnightWindow = (validDay && openMinutes > lastOrderMinutes && currentMinutes >= openMinutes) || previousDayOvernight;
  const acceptingNow = enabled && (sameDayWindow || overnightWindow);
  const nextOpening = findNextOpening(config, now);
  return {
    configured,
    enabled,
    mode: config.outside_hours_mode === 'next_opening' ? 'next_opening' : 'closed',
    accepting_now: acceptingNow,
    next_opening_at: nextOpening?.toISOString() || null
  };
}

module.exports = { getOnlineOrderingState, parseConfig, TIME_ZONE, WEEKDAYS };
