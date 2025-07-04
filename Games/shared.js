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
  elem.classList.add("text-slate-700", "dark:text-slate-100");
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
      elem.classList.remove("text-slate-700", "dark:text-slate-100");
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

async function decompressJSONByURL(URL, ignored) {
  const readableStream = await fetch(URL).then((response) => response.body);

  const decompressionStream = new DecompressionStream("gzip");

  // Pipe the response stream through the decompression stream
  const decompressedStream = readableStream.pipeThrough(decompressionStream);

  // Create a text decoder to decode the decompressed data
  const textDecoder = new TextDecoder();

  // Read and decode the data as it becomes available
  const reader = decompressedStream.getReader();
  let decompressedText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    decompressedText += textDecoder.decode(value);
  }

  return decompressedText;
}

function fetchAndConvertToBase64(url) {
  return fetch(url)
    .then(function (response) {
      return response.blob();
    })
    .then(function (blob) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      });
    });
}

async function decompressAndCheckCacheByURL(URL, updateTS) {
  var cache = localStorage.getItem("cGame" + URL);

  if (cache) {
    const gezipedData = atob(cache);
    const gzipedDataArray = Uint8Array.from(gezipedData, (c) =>
      c.charCodeAt(0)
    );
    const ungzipedData = pako.ungzip(gzipedDataArray);

    const plaintext = new TextDecoder().decode(ungzipedData);
    var JSONData = JSON.parse(plaintext);
    var updatedAt = JSONData.updated_at;

    if (updatedAt == updateTS) {
      console.log("[CACHECHECK] cache hit! Getting the data from the cache");
      return plaintext;
    }
  }

  console.log(
    "[CACHECHECK] timestamps mismatched! Fetching the data for " +
      URL +
      " again from the server!"
  );
  const base64EncodedGZip = await fetchAndConvertToBase64(URL);

  console.log("[CACHECHECK] Bytes written: " + base64EncodedGZip.length);

  localStorage.setItem(
    "cGame" + URL,
    base64EncodedGZip
      .replace(/^data:application\/gzip;base64,/, "")
      .replace(/^data:application\/octet-stream;base64,/, "")
  );

  return decompressJSONByURL(URL);
}

var themeToggleDarkIcon = document.getElementById("theme-toggle-dark-icon");
var themeToggleLightIcon = document.getElementById("theme-toggle-light-icon");

// Change the icons inside the button based on previous settings
if (
  localStorage.getItem("color-theme") === "dark" ||
  (!("color-theme" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  themeToggleLightIcon.classList.remove("hidden");
} else {
  themeToggleDarkIcon.classList.remove("hidden");
}

var themeToggleBtn = document.getElementById("theme-toggle");

themeToggleBtn.addEventListener("click", function () {
  // toggle icons inside button
  themeToggleDarkIcon.classList.toggle("hidden");
  themeToggleLightIcon.classList.toggle("hidden");

  // if set via local storage previously
  if (localStorage.getItem("color-theme")) {
    if (localStorage.getItem("color-theme") === "light") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("color-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("color-theme", "light");
    }

    // if NOT set via local storage previously
  } else {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("color-theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("color-theme", "dark");
    }
  }
});

if (
  localStorage.getItem("color-theme") === "dark" ||
  (!("color-theme" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

function rootURL() {
  return localStorage.getItem("root-url");
}

document.getElementById("go-root-url").href = rootURL();

document.getElementById("go-recent-url").href =
  rootURL() + "/Recent/index.html";
document.getElementById("go-changelog-url").href =
  rootURL() + "/Changelog/index.html";

document
  .getElementById("dropdownNavbar")
  .addEventListener("click", function () {
    const navbar = document.getElementById("navbar-regular");
    if (navbar.classList.contains("max-md:hidden")) {
      document
        .getElementById("navbar-regular")
        .classList.remove("max-md:hidden");
    } else document.getElementById("navbar-regular").classList.add("max-md:hidden");
  });
