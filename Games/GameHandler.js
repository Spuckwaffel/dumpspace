function getGameInfo(info) {
  const params = getUrlParams();
  if (Object.keys(params).length == 0) return;

  if (Object.keys(params)[0] != "hash") return;
  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += "hash=" + params["hash"];

  // Update the browser's URL without refreshing the page
  history.pushState(null, null, currentURLWithoutParams + "&type=" + info);

  // Reload the page to apply the changes
  location.reload();
}

function getClassInfo(info) {
  const params = getUrlParams();
  if (Object.keys(params).length < 2) return;

  if (Object.keys(params)[0] != "hash") return;
  if (Object.keys(params)[1] != "type" || params["type"] != "classes") return;

  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += "hash=" + params["hash"];
  currentURLWithoutParams += "&type=" + params["type"];

  // Update the browser's URL without refreshing the page
  history.pushState(null, null, currentURLWithoutParams + "&class=" + info);

  // Reload the page to apply the changes
  location.reload();
}

function getUrlParams() {
  var params = {}; // Create an empty object to store the parameters

  // Get the URL query string
  var queryString = window.location.search.substring(1);

  // Split the query string into individual parameters
  var paramArray = queryString.split("&");

  // Iterate through the parameter array
  for (var i = 0; i < paramArray.length; i++) {
    var param = paramArray[i].split("=");
    var paramName = decodeURIComponent(param[0]);
    var paramValue = decodeURIComponent(param[1]);

    // Store the parameter in the 'params' object
    params[paramName] = paramValue;
  }

  return params;
}

function goBack() {
  history.pushState(null, null, window.location.origin);
  location.reload();
}

async function getGameByHash(hash) {
  const response = await fetch("GameList.json");
  const data = await response.json();
  return data.games.find((game) => game.hash == hash);
}

const currentPath = "Games/";

//cool function to defeat loading the page without a specified game
const params = getUrlParams();

async function displayGame() {
  const game = await getGameByHash(params["hash"]);
  if (game == null) goBack();

  const gameDir = game.engine + "/" + game.location + "/";

  console.log(gameDir);

  if (params["type"] === "classes") {
    const response = await fetch(gameDir + "ClassesInfo.json");
    const data = await response.json();
    // Sort the "classes" array by the object's name
    data.classes.sort((a, b) => {
      const nameA = Object.keys(a)[0];
      const nameB = Object.keys(b)[0];
      return nameA.localeCompare(nameB);
    });

    timeDiv = document.getElementById("updateLabel");
    if (timeDiv != null) {
      formatElapsedTime(Date.now(), data.updated_at, timeDiv);
    }

    const classDiv = document.getElementById("class-list");

    if (classDiv == null) return;

    var targetClassName,
      targetClassItem = null;

    if (
      Object.keys(params).length === 3 &&
      Object.keys(params)[2] === "class"
    ) {
      targetClassName = params["class"];
    } else if (Object.keys(data.classes).length > 0) {
      targetClassName = Object.keys(data.classes[0])[0];
    }
    for (const gameClass of data.classes) {
      const classButton = document.createElement("button");
      classButton.addEventListener("click", function () {
        getClassInfo(Object.keys(gameClass)[0]);
      });
      classButton.classList.add(
        "px-3",
        "py-2",
        "border-b",
        "border-gray-200",
        "text-left",
        "w-full",
        "transition",
        "duration-200",
        "ease-in-out",
        "hover:text-blue-500"
      );
      classButton.textContent = Object.keys(gameClass)[0];
      classDiv.appendChild(classButton);

      if (
        targetClassName != null &&
        Object.keys(gameClass)[0] === targetClassName
      ) {
        targetClassItem = classButton;
        classButton.classList.add("bg-gray-600/10");
      }
    }

    document.getElementById("class-spinner").remove();

    if (targetClassItem != null) {
      // Calculate the scroll position to center the button within the container
      const containerHeight = classDiv.clientHeight;
      const buttonTop = targetClassItem.offsetTop - classDiv.offsetTop;
      const buttonHeight = targetClassItem.clientHeight;
      const scrollTo = buttonTop - containerHeight / 2 + buttonHeight / 2;

      // Scroll the container to center the button
      classDiv.style.scrollBehavior = "smooth";
      classDiv.scrollTop = scrollTo;
    }
  }
}

if (
  Object.keys(params).length === 0 ||
  Object.keys(params)[0] !== "hash" ||
  params["hash"].length !== 16
) {
  goBack();
}

if (Object.keys(params).length === 1) {
  getGameInfo("classes");
}

displayGame();
