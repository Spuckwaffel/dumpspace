function formatElapsedTime(currentTime, givenTime, elem) {
  const timeElapsed = currentTime - givenTime;
  const secondsInMilli = 1000;
  const minutesInMilli = 60 * secondsInMilli;
  const hoursInMilli = 60 * minutesInMilli;
  const daysInMilli = 24 * hoursInMilli;
  const weeksInMilli = 7 * daysInMilli;
  const monthsInMilli = 30 * daysInMilli;
  const yearsInMilli = 365 * daysInMilli;

  let timeElapsedString = "";

  if (timeElapsed < minutesInMilli) {
    const val = Math.floor(timeElapsed / secondsInMilli);
    timeElapsedString = val + " second" + (val > 1 ? "s" : "");
  } else if (timeElapsed < hoursInMilli) {
    const val = Math.floor(timeElapsed / minutesInMilli);
    timeElapsedString = val + " minute" + (val > 1 ? "s" : "");
  } else if (timeElapsed < daysInMilli) {
    const val = Math.floor(timeElapsed / hoursInMilli);
    timeElapsedString = val + " hour" + (val > 1 ? "s" : "");
  } else if (timeElapsed < weeksInMilli) {
    const val = Math.floor(timeElapsed / daysInMilli);
    timeElapsedString = val + " day" + (val > 1 ? "s" : "");
  } else if (timeElapsed < monthsInMilli) {
    const val = Math.floor(timeElapsed / weeksInMilli);
    timeElapsedString = val + " week" + (val > 1 ? "s" : "");
  } else if (timeElapsed < yearsInMilli) {
    const val = Math.floor(timeElapsed / monthsInMilli);
    timeElapsedString = val + " month" + (val > 1 ? "s" : "");
    if (val >= 1) {
      if (val >= 6) {
        elem.classList.add("text-red-500");
      } else {
        elem.classList.add("text-amber-500");
      }
    }
  } else {
    const years = Math.floor(timeElapsed / yearsInMilli);
    timeElapsedString = years + " year" + (years > 1 ? "s" : "");
    elem.classList.add("text-red-500");
  }
  elem.textContent = timeElapsedString + " ago";
  return elem;
}
