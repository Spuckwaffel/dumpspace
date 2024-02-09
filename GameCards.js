//this file is used for the homepage to add all the game cards

const UE4Widget = document.getElementById("unreal-engine-4-cards");
const UE5Widget = document.getElementById("unreal-engine-5-cards");
const UnityWidget = document.getElementById("unity-cards");
const gameListDiv = document.getElementById("gameListDiv");
const allGamesOpener = document.getElementById("allGamesOpener");
const allGamesDiv = document.getElementById("allGamesDiv");

const currentPath = "Games/";

var gameArray = [];

function createTimeSVG() {
  const svgElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );

  svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgElement.classList.add(
    "w-4",
    "h-4",
    "stroke-black",
    "dark:stroke-slate-100"
  );
  svgElement.setAttribute("viewBox", "0 0 24 24");
  svgElement.setAttribute("fill", "none");

  // Create a path element
  const pathElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );

  // Set the attributes for the path element
  pathElement.setAttribute(
    "d",
    "M12 7V12H15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
  );
  pathElement.setAttribute("stroke-width", "2");
  pathElement.setAttribute("stroke-linecap", "round");
  pathElement.setAttribute("stroke-linejoin", "round");

  // Append the path element to the SVG element
  svgElement.appendChild(pathElement);
  return svgElement;
}

fetch(currentPath + "GameList.json")
  .then((response) => response.json())
  .then((data) => {
    const gamesArray = data.games;

    document.getElementById("supported-games").textContent =
      gamesArray.length + " Supported Games";

    gamesArray.forEach((game) => {
      const box = document.createElement("a");
      box.classList.add(
        "bg-slate-700/10",
        "overflow-hidden",
        "rounded-lg",
        "ring-1",
        "ring-slate-500/5",
        "shadow-sm",
        "transition",
        "duration-300",
        "ease-in-out",
        "hover:shadow-md",
        "hover:dark:shadow-slate-100/10"
      );

      gameArray.push(game);

      const dataPath = currentPath + game.engine + "/" + game.location;
      box.href = currentPath + "?hash=" + game.hash;
      const img = document.createElement("img");
      img.classList.add("md:h-48", "w-full", "sm:h-40", "xl:h-60");
      img.src = dataPath + "/image.jpg";
      img.alt = "missing image.jpg";
      box.appendChild(img);

      const descriptionDiv = document.createElement("div");
      descriptionDiv.classList.add("px-4", "py-2");

      const title = document.createElement("p");
      title.classList.add("font-semibold", "text-lg");
      title.textContent = game.name;
      descriptionDiv.appendChild(title);

      const bottomLineDiv = document.createElement("div");
      bottomLineDiv.classList.add("flex", "justify-between");

      const creditDiv = document.createElement("div");
      creditDiv.classList.add("flex", "space-x-1");

      const byPara = document.createElement("p");
      byPara.classList.add("text-sm");
      byPara.textContent = "By";

      const namePara = document.createElement("a");
      namePara.classList.add("text-sm", "font-semibold", "hover:text-blue-500");
      namePara.textContent = game.uploader.name;
      namePara.href = game.uploader.link;
      namePara.target = "_blank";

      creditDiv.appendChild(byPara);
      creditDiv.appendChild(namePara);

      bottomLineDiv.appendChild(creditDiv);

      descriptionDiv.appendChild(bottomLineDiv);

      const timeDiv = document.createElement("div");
      timeDiv.classList.add("flex", "items-center", "space-x-1");

      let timePara = document.createElement("p");
      timePara.classList.add("text-sm");
      timePara = formatElapsedTime(Date.now(), game.uploaded, timePara);

      timeDiv.appendChild(createTimeSVG());
      timeDiv.appendChild(timePara);

      bottomLineDiv.appendChild(timeDiv);

      box.appendChild(descriptionDiv);

      if (game.engine == "Unreal-Engine-5") {
        UE5Widget.appendChild(box);
      } else if (game.engine == "Unreal-Engine-4") {
        UE4Widget.appendChild(box);
      } else if (game.engine == "Unity") {
        UnityWidget.appendChild(box);
      }
    });
    gameArray.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    handleSearchInput();
  })
  .catch((error) => console.error("Error fetching or parsing JSON:", error));

const searchInput = document.getElementById("class-search-input");
const searchCancelButton = document.getElementById("search-cancel-button");

function createAndPushGameToList(game) {
  const gameListA = document.createElement("a");
  gameListA.classList.add(
    "border-b",
    "border-gray-200",
    "dark:border-gray-600",
    "py-2",
    "px-4",
    "flex",
    "text-slate-700",
    "dark:text-slate-100",
    "transition",
    "duration-200",
    "ease-in-out",
    "hover:text-blue-500",
    "dark:hover:text-blue-500"
  );
  gameListA.href = currentPath + "?hash=" + game.hash;

  const gameListTitle = document.createElement("p");
  gameListTitle.classList.add("pr-2", "text-lg", "font-semibold");
  gameListTitle.textContent = game.name;
  gameListA.appendChild(gameListTitle);

  const gameListEngine = document.createElement("p");
  gameListEngine.classList.add(
    "pr-1",
    "self-center",
    "text-gray-500",
    "dark:text-gray-400"
  );
  gameListEngine.textContent = "- " + game.engine;
  gameListA.appendChild(gameListEngine);

  const gameListCreator = document.createElement("a");
  gameListCreator.classList.add(
    "px-2",
    "self-center",
    "text-gray-500",
    "dark:text-gray-400",
    "hover:text-blue-500",
    "dark:hover:text-blue-500"
  );
  gameListCreator.textContent = game.uploader.name;
  gameListCreator.href = game.uploader.link;
  gameListCreator.target = "_blank";
  gameListA.appendChild(gameListCreator);

  const timeDiv = document.createElement("div");
  timeDiv.classList.add("flex", "items-center", "space-x-1");

  let timePara = document.createElement("p");
  timePara.classList.add("text-sm");
  timePara = formatElapsedTime(Date.now(), game.uploaded, timePara);

  timeDiv.appendChild(createTimeSVG());
  timeDiv.appendChild(timePara);

  gameListA.appendChild(timeDiv);
  gameListDiv.appendChild(gameListA);
}

function handleSearchInput() {
  while (gameListDiv.firstChild) {
    gameListDiv.removeChild(gameListDiv.firstChild);
  }
  var filter = searchInput.value.toUpperCase();
  if (filter.length > 0) {
    searchCancelButton.classList.remove("hidden");
  } else searchCancelButton.classList.add("hidden");
  if (filter === "") {
    for (i = 0; i < gameArray.length; i++) {
      createAndPushGameToList(gameArray[i]);
    }
  } else {
    for (i = 0; i < gameArray.length; i++) {
      if (gameArray[i].name.toUpperCase().includes(filter) === true) {
        createAndPushGameToList(gameArray[i]);
      }
    }
  }
}
searchCancelButton.addEventListener("click", function () {
  searchInput.value = "";
  handleSearchInput();
});

allGamesOpener.addEventListener("click", function () {
  allGamesDiv.classList.remove("hidden");
});

allGamesDivCloser.addEventListener("click", function () {
  allGamesDiv.classList.add("hidden");
});

// this is a very bad fix, this clears the cache of cached game files laying around in localstorage
// if we dont do this the user will eventually get the DOM exception when viewing other games
for (let key in localStorage) {
  if (key.startsWith("cGame")) {
    localStorage.removeItem(key);
  }
}

function removeTrailingSlash(str) {
  if (str.endsWith("/")) {
    return str.slice(0, -1);
  } else {
    return str;
  }
}

//will save the current url (used for raw.githubusercontent)
localStorage.setItem(
  "root-url",
  removeTrailingSlash(window.location.href.split("#")[0].split("index.html"))
);
