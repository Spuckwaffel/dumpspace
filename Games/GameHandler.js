//gets the params of the url
function getUrlParams(url) {
  var params = {}; // Create an empty object to store the parameters

  // Get the URL query string
  var queryString = null;

  if (url == null) {
    queryString = window.location.search.substring(1);
  } else queryString = url.substring(1);

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

//current URL params
const UrlParams = getUrlParams();
var currentURL = window.location.href;

//sets a valid url with params for the target game
function getGameInfo(info) {
  if (Object.keys(UrlParams).length == 0) return;

  if (Object.keys(UrlParams)[0] != "hash") return;
  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += "hash=" + UrlParams["hash"];

  // Update the browser's URL without refreshing the page
  history.pushState(null, null, currentURLWithoutParams + "&type=" + info);

  // Reload the page to apply the changes
  location.reload();
}

//reloads the website with the CName and its type (C,S,F,E)
//only call if the current type does not match the new type
function reloadWithNewCName(CName, newType) {
  //params always need hash and type
  if (Object.keys(UrlParams).length < 2) return;

  //no hash?
  if (Object.keys(UrlParams)[0] != "hash") return;

  //not supported type param?
  if (
    Object.keys(UrlParams)[1] != "type" ||
    (UrlParams["type"] != "classes" && UrlParams["type"] != "structs")
  )
    return;

  if (newType == null) return;

  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += "hash=" + UrlParams["hash"];

  //remove pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  console.log("received type " + newType);

  if (newType === "C") currentURLWithoutParams += "&type=classes";
  else if (newType === "S") currentURLWithoutParams += "&type=structs";

  history.pushState(null, null, currentURLWithoutParams + "&idx=" + CName);
  // Reload the page to apply the changes
  location.reload();
}

//error? go to home page
function returnHome() {
  history.pushState(null, null, window.location.origin);
  console.log("returnHome called? Unexpected issue?");
  throw e;
  //location.reload();
}

//make sure this is always valid
const classDiv = document.getElementById("class-list");
const classDivScroll = document.getElementById("class-list-scroll");

if (classDivScroll.offsetHeight == 256)
  classDivScroll.style.height = 500 + "px";

classDiv.style.height = classDiv.offsetHeight + "px";
classDiv.style.width = "100%";

window.addEventListener("resize", function () {
  //support downscaling, upscaling wont work and wont fix, stop resizing ur window
  //we call this in the tech scene a bandaid fix :)
  if (window.innerWidth < 1280) {
    classDivScroll.style.height = 500 + "px";
    classDiv.style.height = 484 + "px";
  }
});

var GameListJson = null;

async function getGameByHash(hash) {
  if (GameListJson === null) {
    const response = await fetch("GameList.json");
    GameListJson = await response.json();
  }
  return GameListJson.games.find((game) => game.hash == hash);
}

var CurrentInfoJson = null;
var currentType = null;

//only should get called once per reload
async function displayCurrentGame() {
  //params always need hash and type
  if (Object.keys(UrlParams).length < 2) returnHome();

  //no hash?
  if (Object.keys(UrlParams)[0] != "hash") returnHome();

  //not supported type param?
  if (
    Object.keys(UrlParams)[1] != "type" ||
    (UrlParams["type"] != "classes" && UrlParams["type"] != "structs")
  )
    returnHome();

  const game = await getGameByHash(UrlParams["hash"]);
  //no game found for hash? go back
  if (game == null) returnHome();

  const gameDirectory = game.engine + "/" + game.location + "/";

  console.log("crunching latest data for: " + gameDirectory);

  if (UrlParams["type"] === "classes") {
    const response = await fetch(gameDirectory + "ClassesInfo.json");
    CurrentInfoJson = await response.json();
    currentType = "C";
  } else if (UrlParams["type"] === "structs") {
    const response = await fetch(gameDirectory + "StructsInfo.json");
    CurrentInfoJson = await response.json();
    currentType = "S";
  }

  //no data?
  if (CurrentInfoJson == null) returnHome();

  // Sort the array by the object's name
  CurrentInfoJson.data.sort((a, b) => {
    const nameA = Object.keys(a)[0];
    const nameB = Object.keys(b)[0];
    return nameA.localeCompare(nameB);
  });

  var timeDiv = document.getElementById("updateLabel");
  if (timeDiv != null) {
    timeDiv = document.getElementById("updateLabel");
    formatElapsedTime(Date.now(), CurrentInfoJson.updated_at, timeDiv);
  }

  //try getting a valid cname out of the params or get the first index of the json
  if (
    Object.keys(UrlParams).length === 3 &&
    Object.keys(UrlParams)[2] === "idx"
  ) {
    targetClassName = UrlParams["idx"];
    //or select the first one as default
  } else if (Object.keys(CurrentInfoJson.data).length > 0) {
    targetClassName = Object.keys(CurrentInfoJson.data[0])[0];
  } else returnHome();

  console.log("chose name " + targetClassName + " for displaying...");

  displayCurrentStructOrClass(targetClassName);
}

var oldFocussedDataDiv = null;
var formattedArrayDataValid = false;
var formattedArrayData = [];
//only works on current data, if different type than current, call reloadwithnewdata
function displayCurrentStructOrClass(CName) {
  //fixup cnames having pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  //url specific stuff for history

  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += "hash=" + UrlParams["hash"];

  if (currentType === "C") currentURLWithoutParams += "&type=classes";
  else if (currentType === "S") currentURLWithoutParams += "&type=structs";

  currentURLWithoutParams += "&idx=" + CName;

  if (window.location.href !== currentURLWithoutParams) {
    history.pushState(null, null, currentURLWithoutParams);
  }

  currentURL = currentURLWithoutParams;

  //only needed on website refresh
  var scrollToIdx = null;

  var targetIndexData = null;

  var idx = 0;
  for (const gameClass of CurrentInfoJson.data) {
    if (!formattedArrayDataValid)
      formattedArrayData.push(Object.keys(gameClass)[0]);

    if (CName !== null && Object.keys(gameClass)[0] === CName) {
      scrollToIdx = idx;
      targetIndexData = gameClass;
    } else idx++;
  }

  //
  if (targetIndexData === null) {
    if (CName !== Object.keys(CurrentInfoJson.data[0])[0]) {
      showErrorToast("Could not find type " + CName + "!");
      displayCurrentStructOrClass(Object.keys(CurrentInfoJson.data[0])[0]);
      return;
    }
  }

  if (!formattedArrayDataValid) {
    new VanillaRecyclerView(classDiv, {
      data: formattedArrayData,
      renderer: class {
        initialize(params) {
          this.layout = document.createElement("button");
          this.layout.innerHTML = params.data;
          this.layout.classList.add(
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
          if (targetClassName != null && params.data === targetClassName) {
            this.layout.classList.add("bg-gray-600/10");
            oldFocussedDataDiv = this.layout;
          }
          this.layout.addEventListener("click", function (event) {
            //remove the by of the old button
            if (
              oldFocussedDataDiv != null &&
              oldFocussedDataDiv.classList.contains("bg-gray-600/10")
            ) {
              oldFocussedDataDiv.classList.remove("bg-gray-600/10");
            }
            oldFocussedDataDiv = event.target;
            event.target.classList.add("bg-gray-600/10");
            displayCurrentStructOrClass(params.data);
          });
        }
        getLayout() {
          return this.layout;
        }
        onUnmount() {}
      },
    });

    if (scrollToIdx !== null) {
      // calculating the box with a fixed size of 50px lol
      const containerHeight = classDiv.clientHeight;
      const buttonTop = scrollToIdx * 50 - classDiv.offsetTop;
      const scrollTo = buttonTop - containerHeight / 2 + 100;

      // Scroll the container to center the button
      //classDiv.style.scrollBehavior = "smooth";
      classDiv.scrollTop = scrollTo;
    }
    formattedArrayDataValid = true;
  }

  displayMembers(CName, targetIndexData);
}

//save them, used by displayOverviewPage to restore the sticky bar
const emtpyOverViewDivChildren = Array.from(
  document.getElementById("overview-items").children
);

function displayOverviewPage(members) {
  const itemsOverviewDiv = document.getElementById("overview-items");
  //remove old children
  while (itemsOverviewDiv.firstChild) {
    itemsOverviewDiv.removeChild(itemsOverviewDiv.firstChild);
  }
  for (const child of emtpyOverViewDivChildren) {
    itemsOverviewDiv.appendChild(child);
  }
  for (const member of members) {
    const memberName = Object.keys(member)[0];
    if (memberName === "__InheritInfo") continue;
    if (memberName === "__MDKClassSize") continue;
    const overviewMemberDiv = document.createElement("div");
    overviewMemberDiv.classList.add(
      "grid",
      "grid-cols-8",
      "text-sm",
      "px-6",
      "text-gray-600",
      "pt-2",
      "pb-2",
      "border-b",
      "border-gray-200"
    );

    const memberNameButton = document.createElement("button");
    memberNameButton.classList.add("col-span-3", "text-left", "truncate");
    memberNameButton.textContent = member[Object.keys(member)[0]][0];

    const memberType = member[Object.keys(member)[0]][3];
    if (memberType === "C" || memberType === "S") {
      memberNameButton.classList.add("underline");
      memberNameButton.addEventListener("click", function () {
        if (currentType != memberType) {
          reloadWithNewCName(memberNameButton.textContent, memberType);
        } else displayCurrentStructOrClass(memberNameButton.textContent);
      });
    } else memberNameButton.classList.add("cursor-default");

    overviewMemberDiv.appendChild(memberNameButton);

    const memberNameP = document.createElement("p");
    memberNameP.classList.add("col-span-3", "truncate");
    memberNameP.textContent = memberName;
    overviewMemberDiv.appendChild(memberNameP);

    const memberOffsetP = document.createElement("p");
    memberOffsetP.classList.add("col-span-1", "font-mono");
    memberOffsetP.textContent =
      "0x" + member[Object.keys(member)[0]][1].toString(16);
    overviewMemberDiv.appendChild(memberOffsetP);

    const memberSizeP = document.createElement("p");
    memberSizeP.classList.add("col-span-1", "pl-8", "font-mono");
    const memberSizeVal = member[Object.keys(member)[0]][2];
    memberSizeP.textContent = memberSizeVal;
    if (memberSizeVal < 10) memberSizeP.textContent += "\u00A0";
    if (memberSizeVal < 100) memberSizeP.textContent += "\u00A0";

    overviewMemberDiv.appendChild(memberSizeP);

    itemsOverviewDiv.appendChild(overviewMemberDiv);
  }
}

function displayStructAndMDKPage(CName, members) {
  var textAreaSDKRows = 0;
  var textAreaMDKRows = 0;
  var textAreaSDKText = "// Inheritance: ";
  var textAreaMDKText = "// Inheritance: ";
  for (const member of members) {
    const memberName = Object.keys(member)[0];
    if (memberName === "__InheritInfo") {
      var i = 0;

      var _MDKText = "";
      for (const superClass of member["__InheritInfo"]) {
        textAreaSDKText += superClass;
        textAreaMDKText += superClass;
        if (i < member["__InheritInfo"].length - 1) {
          textAreaSDKText += " > ";
          textAreaMDKText += " > ";
        }
        if (i == 0) {
          _MDKText =
            "class " +
            CName +
            " : public " +
            superClass +
            "\n{\n	friend MDKHandler;\n";

          if (currentType === "S") {
            _MDKText += "	friend MDKBase;\n";
            textAreaMDKRows++;
          }
          textAreaMDKRows += 3;
        }

        i++;
      }

      textAreaMDKText += _MDKText;
      textAreaMDKRows++;
      textAreaSDKText += "\nnamespace " + CName + " {\n";
      textAreaSDKRows += 2;
      continue;
    }
    if (memberName === "__MDKClassSize") {
      textAreaMDKText +=
        "	static inline constexpr uint64_t __MDKClassSize = " +
        member["__MDKClassSize"] +
        ";\n\npublic:\n";
      textAreaMDKRows += 3;
      continue;
    }

    textAreaSDKText += "	constexpr auto ";
    //copy due to changes if its a bit
    var _memberName = memberName;
    //is it a bit?
    var isBitMember = false;
    if (
      _memberName.length > 4 &&
      _memberName.charAt(_memberName.length - 3) === ":"
    ) {
      isBitMember = true;
      _memberName = _memberName.slice(0, -4);
    }
    //use the new name
    textAreaSDKText += _memberName + " = ";
    //we love hex
    textAreaSDKText +=
      "0x" + member[Object.keys(member)[0]][1].toString(16) + ";";

    //type of the member
    textAreaSDKText += " // " + member[Object.keys(member)[0]][0];
    if (isBitMember) textAreaSDKText += " : 1";
    textAreaSDKText += "\n";
    textAreaSDKRows++;

    //create a new one for shenanigans with the length
    var _textAreaMDKText =
      "	" +
      member[Object.keys(member)[0]][3] +
      "Member(" +
      member[Object.keys(member)[0]][0] +
      ")";
    //format it good aligned
    while (_textAreaMDKText.length < 54) {
      _textAreaMDKText += " ";
    }
    _textAreaMDKText += _memberName;
    while (_textAreaMDKText.length < 114) {
      _textAreaMDKText += " ";
    }
    _textAreaMDKText += "OFFSET(get";
    if (member[Object.keys(member)[0]][3] == "C") {
      _textAreaMDKText += "<T>, ";
    } else if (member[Object.keys(member)[0]][3] == "S") {
      _textAreaMDKText += "Struct<T>, ";
    } else if (member[Object.keys(member)[0]][3] == "D") {
      _textAreaMDKText += "<" + member[Object.keys(member)[0]][0] + ">, ";
    }
    _textAreaMDKText +=
      "{" + "0x" + member[Object.keys(member)[0]][1].toString(16) + ", ";
    _textAreaMDKText += member[Object.keys(member)[0]][2] + ", ";
    if (isBitMember)
      _textAreaMDKText += "1, " + member[Object.keys(member)[0]][4] + "})\n";
    else _textAreaMDKText += "0, 0})\n";

    textAreaMDKText += _textAreaMDKText;
    textAreaMDKRows++;
  }

  textAreaSDKText += "}";
  textAreaMDKText += "};";
  textAreaSDKRows++;
  textAreaMDKRows += 2;

  var SDKTextArea = document.getElementById("struct-items-textarea");
  if (SDKTextArea != null) {
    SDKTextArea.textContent = textAreaSDKText;
    SDKTextArea.rows = textAreaSDKRows;
  }
  var MDKTextArea = document.getElementById("MDK-items-textarea");
  if (MDKTextArea != null) {
    MDKTextArea.textContent = textAreaMDKText;
    MDKTextArea.rows = textAreaMDKRows;
  }
}

function displayMembers(CName, data) {
  const members = data[Object.keys(data)[0]];

  if (document.getElementById("class-desc-name") !== null)
    document.getElementById("class-desc-name").textContent = CName;

  var classInheritDiv = document.getElementById("class-desc-inherits");
  if (classInheritDiv == null) returnHome();

  while (classInheritDiv.firstChild) {
    classInheritDiv.removeChild(classInheritDiv.firstChild);
  }

  for (const member of members) {
    const memberName = Object.keys(member)[0];
    //super stuff
    if (memberName === "__InheritInfo") {
      var i = 0;

      for (const superClass of member["__InheritInfo"]) {
        const superButton = document.createElement("button");

        superButton.addEventListener("click", function () {
          displayCurrentStructOrClass(superClass);
        });
        superButton.classList.add(
          "transition",
          "duration-200",
          "ease-in-out",
          "hover:text-blue-500"
        );
        superButton.textContent = superClass;

        classInheritDiv.appendChild(superButton);
        if (i < member["__InheritInfo"].length - 1) {
          const textNode = document.createTextNode("\u00A0>\u00A0");
          classInheritDiv.appendChild(textNode);
        }

        i++;
      }
    }
  }

  displayOverviewPage(members);
  displayStructAndMDKPage(CName, members);

  if (document.getElementById("overview-items-skeleton") != null) {
    document.getElementById("overview-items-skeleton").remove();
  }

  if (document.getElementById("class-skeleton") != null) {
    document.getElementById("class-skeleton").remove();
  }
}

function showOverview() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (itemOverview != null && itemOverview.classList.contains("hidden"))
    itemOverview.classList.remove("hidden");
  if (itemClickDiv != null) itemClickDiv.classList.add("bg-gray-50");

  if (structOverview != null) structOverview.classList.add("hidden");
  if (structClickDiv != null && structClickDiv.classList.contains("bg-gray-50"))
    structClickDiv.classList.remove("bg-gray-50");

  if (MDKOverview != null) MDKOverview.classList.add("hidden");
  if (MDKClickDiv != null && MDKClickDiv.classList.contains("bg-gray-50"))
    MDKClickDiv.classList.remove("bg-gray-50");
}

function showStruct() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (structOverview != null && structOverview.classList.contains("hidden"))
    structOverview.classList.remove("hidden");
  if (structClickDiv != null) structClickDiv.classList.add("bg-gray-50");

  if (itemOverview != null) itemOverview.classList.add("hidden");
  if (itemClickDiv != null && itemClickDiv.classList.contains("bg-gray-50"))
    itemClickDiv.classList.remove("bg-gray-50");

  if (MDKOverview != null) MDKOverview.classList.add("hidden");
  if (MDKClickDiv != null && MDKClickDiv.classList.contains("bg-gray-50"))
    MDKClickDiv.classList.remove("bg-gray-50");
}

function showMDK() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (MDKOverview != null && MDKOverview.classList.contains("hidden"))
    MDKOverview.classList.remove("hidden");
  if (MDKClickDiv != null) MDKClickDiv.classList.add("bg-gray-50");

  if (structOverview != null) structOverview.classList.add("hidden");
  if (structClickDiv != null && structClickDiv.classList.contains("bg-gray-50"))
    structClickDiv.classList.remove("bg-gray-50");

  if (itemOverview != null) itemOverview.classList.add("hidden");
  if (itemClickDiv != null && itemClickDiv.classList.contains("bg-gray-50"))
    itemClickDiv.classList.remove("bg-gray-50");
}

if (
  Object.keys(UrlParams).length === 0 ||
  Object.keys(UrlParams)[0] !== "hash" ||
  UrlParams["hash"].length !== 16
) {
  returnHome();
}

if (Object.keys(UrlParams).length === 1) {
  getGameInfo("classes");
}

//add reload listener
window.addEventListener("popstate", function () {
  var oldParams = getUrlParams(currentURL);
  var newParams = getUrlParams();
  if (
    newParams == null ||
    newParams.length < 3 ||
    Object.keys(newParams)[0] != "hash" ||
    Object.keys(newParams)[1] != "type" ||
    oldParams[Object.keys(oldParams)[0]] !==
      newParams[Object.keys(newParams)[0]] ||
    oldParams[Object.keys(oldParams)[1]] !==
      newParams[Object.keys(newParams)[1]] ||
    newParams[Object.keys(newParams)[2]] == null
  )
    location.reload();

  displayCurrentStructOrClass(newParams[Object.keys(newParams)[2]]);
});

//display! yay!
displayCurrentGame();

const toastDiv = document.getElementById("toast-div");
const toastDivText = document.getElementById("toast-div-text");

toastDiv.addEventListener("click", function () {
  // Show the floating div
  toastDiv.classList.remove("opacity-100");
  toastDiv.classList.add("opacity-0");
});

function showErrorToast(name) {
  if (toastDiv != null) {
    toastDiv.classList.remove("opacity-0");
  }
  toastDiv.classList.add("opacity-100");

  if (toastDivText != null) toastDivText.textContent = name;
}
