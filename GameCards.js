//this file is used for the homepage to add all the game cards

const UE3Widget = document.getElementById("unreal-engine-3-cards");
const UE4Widget = document.getElementById("unreal-engine-4-cards");
const UE5Widget = document.getElementById("unreal-engine-5-cards");
const UnityWidget = document.getElementById("unity-cards");
const gameListDiv = document.getElementById("gameListDiv");
const allGamesOpener = document.getElementById("allGamesOpener");
const allGamesDiv = document.getElementById("allGamesDiv");
const sortButton = document.getElementById("sortButton");

const currentPath = "Games/";

var gameArray = [];

function createTimeSVG(hideClock) {
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
  if (hideClock !== null && hideClock === true)
    svgElement.classList.add("max-sm:hidden");
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

fetch(currentPath + "Starboard.json")
  .then((response) => response.json())
  .then((data) => {
    data.sort((a, b) => b.count - a.count);

    // Take the top 5 elements
    const top5 = data.slice(0, 5);
    top5.forEach((contributor) => {
      // Create the outer div
      const outerDiv = document.createElement("div");
      outerDiv.classList.add(
        "items-center",
        "flex",
        "space-x-4",
        "bg-slate-200/10",
        "rounded-lg",
        "p-4",
        "ring-1",
        "ring-slate-500/10",
        "shadow-sm",
        "hover:dark:shadow-slate-100/10",
        "transition",
        "duration-300",
        "ease-in-out",
        "hover:shadow-md"
      );

      // Create the inner div for the image
      const imgDiv = document.createElement("div");
      const img = document.createElement("img");
      img.classList.add("w-16", "rounded-full");
      img.src = contributor.aurl;
      img.alt = "contributor";
      imgDiv.appendChild(img);

      // Create the inner div for the text
      const textDiv = document.createElement("div");
      const nameP = document.createElement("a");
      nameP.classList.add(
        "font-semibold",
        "text-lg",
        "dark:text-slate-100",
        "hover:text-blue-500",
        "dark:hover:text-blue-500"
      );
      nameP.textContent = contributor.name;
      nameP.href = contributor.url;
      const starsP = document.createElement("p");
      starsP.classList.add("text-sm", "dark:text-slate-300");
      starsP.textContent = contributor.count + " Game Updates";
      textDiv.appendChild(nameP);
      textDiv.appendChild(starsP);

      // Append the inner divs to the outer div
      outerDiv.appendChild(imgDiv);
      outerDiv.appendChild(textDiv);
      document.getElementById("topContributors").appendChild(outerDiv);
    });
  });

async function createCardsX(type) {
  gameArray = [];
  UE5Widget.innerHTML = "";
  UE4Widget.innerHTML = "";
  UE3Widget.innerHTML = "";
  UnityWidget.innerHTML = "";
  const res = await fetch(currentPath + "GameList.json");
  const data = await res.json();

  console.log("sorting after ", type);

  let gamesArray = data.games;

  //if (type == "CD") nothing;
  if (type == "AB") gamesArray.sort((a, b) => a.name.localeCompare(b.name));
  else if (type == "LU") gamesArray.sort((a, b) => b.uploaded - a.uploaded);
  else if (type == "UL")
    gamesArray.sort((a, b) => a.uploader.name.localeCompare(b.uploader.name));

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
    img.loading = "lazy";
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
    } else if (game.engine == "Unreal-Engine-3") {
      UE3Widget.appendChild(box);
    } else if (game.engine == "Unity") {
      UnityWidget.appendChild(box);
    }
  });
  gameArray.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  handleSearchInput();
}

const savedSortingType = localStorage.getItem("cardSortType") || "CD";

setLabelByDataType(savedSortingType);

createCardsX(savedSortingType);

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
    "text-slate-700",
    "dark:text-slate-100",
    "transition",
    "duration-200",
    "ease-in-out",
    "hover:text-blue-500",
    "dark:hover:text-blue-500",
    "grid",
    "grid-cols-5"
  );
  gameListA.href = currentPath + "?hash=" + game.hash;

  const gameListTitle = document.createElement("p");
  gameListTitle.classList.add("pr-2", "text-lg", "font-semibold", "col-span-2");
  gameListTitle.textContent = game.name;
  gameListA.appendChild(gameListTitle);

  const gameListEngine = document.createElement("p");
  gameListEngine.classList.add(
    "pr-1",
    "self-center",
    "text-gray-500",
    "dark:text-gray-400",
    "max-sm:hidden"
  );
  gameListEngine.textContent = game.engine.replace(/-/g, " ");
  gameListA.appendChild(gameListEngine);

  const gameListCreator = document.createElement("a");
  gameListCreator.classList.add(
    "px-2",
    "self-center",
    "text-gray-500",
    "dark:text-gray-400",
    "hover:text-blue-500",
    "dark:hover:text-blue-500",
    "max-sm:col-span-2",
    "truncate"
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

  timeDiv.appendChild(createTimeSVG(true));
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
  document.getElementById("class-search-input").focus(); // Focus on the input
  handleSearchInput();
});

allGamesOpener.addEventListener("click", function () {
  allGamesDiv.classList.remove("hidden");
  searchInput.value = "";
  document.getElementById("class-search-input").focus(); // Focus on the input
  handleSearchInput();
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

sortButton.addEventListener("click", function () {
  document.getElementById("game-sort-dropdown").classList.toggle("hidden");
});

function setLabelByDataType(dataType) {
  // Select the label element with the matching data-type attribute.
  const labelElement = document.querySelector(`label[data-type="${dataType}"]`);

  // If the label exists, return its text content.
  // Otherwise, return a message indicating it wasn't found.

  document.getElementById("sort-type").textContent = labelElement
    ? labelElement.textContent
    : "...";

  if (labelElement) {
    const radioId = labelElement.getAttribute("for");
    const radioButton = document.getElementById(radioId);

    // 3. If the radio button exists, set its 'checked' property to true.
    if (radioButton) {
      radioButton.checked = true;
    }
  }
}

function handleGameSort() {
  const selectedRadio = document.querySelector(
    'input[name="game-sort-radio"]:checked'
  );
  const selectedValue = document.querySelector(
    `label[for="${selectedRadio.id}"]`
  );

  const sortType = selectedValue.dataset.type;

  console.log(`select: ${sortType}`);

  document.getElementById("game-sort-dropdown").classList.toggle("hidden");

  localStorage.setItem("cardSortType", sortType);

  document.getElementById("sort-type").textContent = selectedValue.textContent;

  createCardsX(sortType);
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
  removeTrailingSlash(window.location.href.split("#")[0].split("index.html")[0])
);
