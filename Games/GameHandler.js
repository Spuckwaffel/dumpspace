//gets the params of the url, expects to be a full valid url, example.com/?param=abc
//if the url is empty, it will use the current window.location.search
function getUrlParams(url) {
  var params = {}; // Create an empty object to store the parameters

  // Get the URL query string
  var queryString = null;

  //remove the ugly ?
  if (url == null) {
    queryString = window.location.search.substring(1);
  } else queryString = url.substring(1);

  // Split the query string into individual parameters
  var paramArray = queryString.split("&");

  // Iterate through the parameter array
  for (var i = 0; i < paramArray.length; i++) {
    var param = paramArray[i].split("=");
    var paramName = decodeURIComponent(param[0]);
    try {
      var paramValue = decodeURIComponent(param[1]);
      // Store the parameter in the 'params' object
      params[paramName] = paramValue;
    } catch (err) {
      params[paramName] = "";
    }
  }

  //return the params
  return params;
}

//current URL params and stored in a global var
var UrlParams = getUrlParams();
var currentURL = window.location.href;

//sets a valid url with params for the target game
function getGameInfo(info, reload = true, newWindow = false, push = true) {
  //no url params? thats weird
  if (Object.keys(UrlParams).length == 0) return;

  //the first param always has to be the game hash
  if (Object.keys(UrlParams)[0] != "hash") return;
  var newURL = window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  newURL += "hash=" + UrlParams["hash"] + "&type=" + info;

  if (newWindow) {
    window.open(newURL, "_blank");
  } else {
    if (push) {
      console.log("[getGameInfo] pushing state " + newURL);
      history.pushState(null, null, newURL);
    } else {
      console.log(
        "[getGameInfo] replacing state " + currentURL + " with " + newURL
      );
      history.replaceState(null, null, newURL);
    }
    currentURL = newURL;

    if (reload) location.reload();

    //fetch the new url params
    UrlParams = getUrlParams();
  }
}

//reloads the website with the CName and its type (C,S,F,E)
//only call if the current type does not match the new type
function reloadWithNewCName(CName, newType, member, newWindow = false) {
  //params always need hash and current type
  if (Object.keys(UrlParams).length < 2) return;

  //no hash?
  if (Object.keys(UrlParams)[0] != "hash") return;

  //not supported type param?
  if (
    Object.keys(UrlParams)[1] != "type" ||
    (UrlParams["type"] != "classes" &&
      UrlParams["type"] != "structs" &&
      UrlParams["type"] != "functions" &&
      UrlParams["type"] != "enums")
  )
    return;

  if (newType == null) return;

  //craft the new valid url
  var newURL = window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  newURL += "hash=" + UrlParams["hash"];

  //remove pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  if (newType === "C") newURL += "&type=classes";
  else if (newType === "S") newURL += "&type=structs";
  else if (newType === "F") newURL += "&type=functions";
  else if (newType === "E") newURL += "&type=enums";

  if (member) {
    newURL += "&idx=" + CName + "&member=" + member;
    console.log("[reloadWithNewCName] pushing " + newURL);
    if (newWindow) window.open(newURL, "_blank");
    else history.pushState(null, null, newURL);
  } else {
    newURL += "&idx=" + CName;
    console.log("[reloadWithNewCName] pushing " + newURL);
    if (newWindow) window.open(newURL, "_blank");
    else history.pushState(null, null, newURL);
  }

  // Reload the page to apply the changes
  if (!newWindow) location.reload();
}

//error? go to home page
function returnHome() {
  history.pushState(null, null, window.location.origin);
  console.log("returnHome called? Unexpected issue?");
  throw e;
  location.reload();
}

//make sure this is always valid
const classDiv = document.getElementById("class-list");
const classDivScroll = document.getElementById("class-list-scroll");

//this is just for some vanillarecylverview to support mobile devices
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

//current gamelistJSON is alwys empty and gets fetched by the server again
var GameListJson = null;

//gets the current game json info by the given hash
async function getGameInfoJsonByHash(hash) {
  if (GameListJson === null) {
    const response = await fetch("GameList.json");
    GameListJson = await response.json();
  }
  return GameListJson.games.find((game) => game.hash == hash);
}

//the current json of the game containing the real data, eg struct or class
var currentInfoJson = null;
//the current display type, eg struct or class
var currentType = null;

var gameName = "";

var gameDirectory = "";

var fileVersion = 0;

var uploadTS = null;
//only should get called once per reload
//makes the game ready to be displayed with displayCurrentType and has basic checks
async function displayCurrentGame() {
  //params always need hash and type
  if (Object.keys(UrlParams).length < 2) returnHome();

  //no hash?
  if (Object.keys(UrlParams)[0] != "hash") returnHome();

  //not supported type param?
  if (
    Object.keys(UrlParams)[1] != "type" ||
    (UrlParams["type"] != "classes" &&
      UrlParams["type"] != "structs" &&
      UrlParams["type"] != "functions" &&
      UrlParams["type"] != "enums" &&
      UrlParams["type"] != "offsets")
  )
    returnHome();

  //get the game json info
  const gameInfoJson = await getGameInfoJsonByHash(UrlParams["hash"]);
  //no game found for hash? go back
  if (gameInfoJson == null) returnHome();

  gameName = gameInfoJson.name;

  uploadTS = gameInfoJson.uploaded;

  //directory is always engine path + location
  gameDirectory = gameInfoJson.engine + "/" + gameInfoJson.location + "/";

  console.log(
    "[displayCurrentGame] Crunching latest data for: " +
      gameDirectory +
      " - " +
      UrlParams["type"]
  );

  //get the data for the current type and check cache persistance
  if (UrlParams["type"] === "classes") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "ClassesInfo.json.gz",
      uploadTS
    );
    currentInfoJson = JSON.parse(response);
    currentType = "C";
  } else if (UrlParams["type"] === "structs") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "StructsInfo.json.gz",
      uploadTS
    );
    currentInfoJson = JSON.parse(response);
    currentType = "S";
  } else if (UrlParams["type"] === "functions") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "FunctionsInfo.json.gz",
      uploadTS
    );
    currentInfoJson = JSON.parse(response);
    currentType = "F";
  } else if (UrlParams["type"] === "enums") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "EnumsInfo.json.gz",
      uploadTS
    );
    currentInfoJson = JSON.parse(response);
    currentType = "E";
  } else if (UrlParams["type"] === "offsets") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "OffsetsInfo.json.gz",
      uploadTS
    );
    currentInfoJson = JSON.parse(response);
    currentType = "O";
  }

  //no data?
  if (currentInfoJson == null) returnHome();

  // Sort the array by the object's name
  currentInfoJson.data.sort((a, b) => {
    const nameA = Object.keys(a)[0];
    const nameB = Object.keys(b)[0];
    return nameA.localeCompare(nameB);
  });

  //update the time label
  var timeDiv = document.getElementById("updateLabel");
  if (timeDiv != null) {
    formatElapsedTime(Date.now(), currentInfoJson.updated_at, timeDiv);
  }

  fileVersion = currentInfoJson.version;

  console.log("[DisplayCurrentGame] Using version " + fileVersion);

  //custom
  if (currentType === "O") {
    showOffsets(currentInfoJson.credit, currentInfoJson.data);
    return;
  }

  if (
    (Object.keys(UrlParams).length === 3 ||
      Object.keys(UrlParams).length === 4) &&
    Object.keys(UrlParams)[2] === "idx"
  ) {
    //try getting a valid cname out of the params or get the first index of the json
    targetClassName = UrlParams["idx"];
    //or select the first one as default
  } else if (Object.keys(currentInfoJson.data).length > 0) {
    targetClassName = Object.keys(currentInfoJson.data[0])[0];
    //yeah if there arent any items what are we supposed to show lol
  } else returnHome();

  console.log(
    "[displayCurrentGame] Chose name " + targetClassName + " for displaying..."
  );

  var member = null;
  if (Object.keys(UrlParams).length === 4) {
    member = UrlParams["member"];
    console.log("[displayCurrentGame] Focussing member " + member);
  }
  //actual baking
  displayCurrentType(targetClassName, member);
}

//persistent global data
//used for vanilla recycler to unhighlight the older focussed div
var focussedCName = null;
//whether we ever formatted the data with vanillarecycler view
var formattedArrayDataValid = false;
//the formatted data we display in the vrv
var formattedArrayData = [];
//storing the vrv object
var dVanillaRecyclerView = null;

var firstScroll = true;
var focussedCNameVisible = false;

function fixHighlightColor() {
  // Get the child div that contains the buttons
  var childDiv = classDiv.querySelector("div");

  var divs = childDiv.querySelectorAll("div");

  var found = false;
  divs.forEach(function (div) {
    var childButton = div.querySelector("button");
    if (childButton == null) return;
    if (focussedCName !== null && focussedCName === childButton.textContent) {
      childButton.classList.add("bg-gray-600/10");

      found = true;
    } else {
      childButton.classList.remove("bg-gray-600/10");
    }
  });
  focussedCNameVisible = found;
}

//only works on current data, if different type than current, call reloadwithnewdata
//good thing about being able to call this func is no refetching of any data, so being once in a viewer
//yoi can navigate every item in the viewer without reloading
function displayCurrentType(CName, member) {
  console.log("[displayCurrentType] Trying to display " + CName);
  focussedCNameVisible = false;
  //fixup cnames having pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  //url specific stuff for history

  // no matter what, reset the url params
  var newURL = "?hash=" + UrlParams["hash"];

  var hadIdx = Object.keys(UrlParams).includes("idx");

  if (currentType === "C") newURL += "&type=classes";
  else if (currentType === "S") newURL += "&type=structs";
  else if (currentType === "F") newURL += "&type=functions";
  else if (currentType === "E") newURL += "&type=enums";

  newURL += "&idx=" + CName;

  if (member) {
    newURL += "&member=" + member;
  }

  const oldURL = currentURL;
  currentURL = window.location.origin + window.location.pathname + newURL;
  UrlParams = getUrlParams(newURL);

  //only needed on website refresh or clicking on different items
  var scrollToIdx = 0;

  var targetGameClass = null;

  var idx = 0;
  //get the index scroll and also format the data if never formatted (first run)
  for (const gameClass of currentInfoJson.data) {
    idx++;
    if (!formattedArrayDataValid)
      formattedArrayData.push(Object.keys(gameClass)[0]);

    if (CName !== null && Object.keys(gameClass)[0] === CName) {
      scrollToIdx = idx;
      targetGameClass = gameClass;
    }
  }

  //is the target game class even there?
  if (targetGameClass == null) {
    //just a bandaid fix displaying older toasts lol
    if (CName != Object.keys(currentInfoJson.data[0])[0]) {
      console.log("[displayCurrentType] Could not find " + CName);
      showToast("Could not find type " + CName + "!");
      //go back to older one that worked, however we dont store the entire url so we have to do some trickery
      const paramsBefore = getUrlParams("." + oldURL.split("?")[1]);
      //guaranteed to be valid
      if (oldURL === currentURL)
        displayCurrentType(Object.keys(currentInfoJson.data[0])[0]);
      else displayCurrentType(paramsBefore[Object.keys(paramsBefore)[2]]);
      return;
    }
  }

  //now we can push, the entry is valid. we do this to not push invalid shit
  if (window.location.href !== currentURL) {
    if (hadIdx) {
      console.log("[displayCurrentType] Pushed " + currentURL + " to history");
      history.pushState(null, "", currentURL);
    } else {
      console.log(
        "[displayCurrentType] Replaced " +
          oldURL +
          " with " +
          currentURL +
          " in history"
      );
      history.replaceState(null, "", currentURL);
    }
  }
  document.title = "Dumpspace - " + gameName;
  document.getElementById("dumpspace-text").textContent = document.title;

  focussedCName = CName;

  //first time? make the vrv
  if (!formattedArrayDataValid) {
    dVanillaRecyclerView = new VanillaRecyclerView(classDiv, {
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
            "dark:border-gray-600",
            "text-left",
            "w-full",
            "transition",
            "duration-200",
            "ease-in-out",
            "hover:text-blue-500",
            "truncate"
          );
          if (targetClassName != null && params.data === targetClassName) {
            this.layout.classList.add("bg-gray-600/10");
          }
          this.layout.addEventListener("mouseup", function (event) {
            if (event.button === 1) {
              event.stopPropagation();
              reloadWithNewCName(params.data, currentType, null, true);
            } else {
              //change the focusseddataname
              focussedCName = params.data;
              fixHighlightColor();
              displayCurrentType(params.data);
            }
          });
        }
        getLayout() {
          return this.layout;
        }
        onUnmount() {}
        onMount() {
          fixHighlightColor();
        }
      },
    });

    formattedArrayDataValid = true;
  }

  //fix the current highlight color because if we do no page reloads we most likely focus a different class
  fixHighlightColor();

  //only scroll if the focussedcname isnt visible in the view, otherwise it has a ugly look
  if (scrollToIdx > 0 && !focussedCNameVisible) {
    // calculating the box with a fixed size of 50px lol
    var scrollTo = scrollToIdx * 50;

    if (firstScroll) {
      scrollTo += 200;
      firstScroll = false;
    } else {
      scrollTo -= 300;
    }

    // Scroll the container to center the button
    //classDiv.style.scrollBehavior = "smooth";
    classDiv.scrollTop = scrollTo;
  }

  if (currentType === "C" || currentType === "S")
    displayMembers(CName, targetGameClass);
  if (currentType === "F") displayFunctions(CName, targetGameClass);
  if (currentType === "E") displayEnums(CName, targetGameClass);
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
  var focusIdx = 0;
  var focusFound = false;
  var memberItemHeight = 0;
  for (const member of members) {
    const memberName = Object.keys(member)[0];
    if (memberName === "__InheritInfo") continue;
    if (memberName === "__MDKClassSize") continue;

    const overviewMemberDiv = document.createElement("div");
    overviewMemberDiv.classList.add(
      "max-sm:w-[70vh]",
      "grid",
      "grid-cols-8",
      "text-sm",
      "px-2",
      "sm:px-6",
      "text-slate-700",
      "dark:text-slate-100",
      "pt-2",
      "pb-2",
      "border-b",
      "border-gray-200",
      "dark:border-gray-600"
    );

    const memberTypeDiv = document.createElement("div");
    memberTypeDiv.classList.add("col-span-3", "flex");

    let cookMemberType = (typeArr) => {
      const memberTypeButton = document.createElement("button");
      memberTypeButton.classList.add("text-left", "truncate");
      memberTypeButton.textContent = typeArr[0];
      if (typeArr[1] === "C" || typeArr[1] === "S" || typeArr[1] === "E") {
        memberTypeButton.classList.add("underline", "dark:decoration-gray-400");
        memberTypeButton.addEventListener(
          "mouseup",
          function (currentType, memberType, cname, event) {
            if (event.button === 1) {
              event.stopPropagation();
              reloadWithNewCName(cname, memberType, null, true);
            } else {
              if (currentType != memberType) {
                reloadWithNewCName(cname, memberType);
              } else displayCurrentType(cname);
            }
          }.bind(null, currentType, typeArr[1], typeArr[0])
        );
      } else memberTypeButton.classList.add("cursor-default");
      memberTypeDiv.appendChild(memberTypeButton);
      if (typeArr[3].length > 0) {
        const templateOpenP = document.createElement("p");
        templateOpenP.textContent = "<";
        memberTypeDiv.appendChild(templateOpenP);
        var i = 0;
        for (const submember of typeArr[3]) {
          cookMemberType(submember);
          if (i < typeArr[3].length - 1) {
            const commaP = document.createElement("p");
            commaP.classList.add("pr-1");
            commaP.textContent = ",";
            memberTypeDiv.appendChild(commaP);
          }
          i++;
        }
        const templateCloseP = document.createElement("p");
        templateCloseP.textContent = ">";
        memberTypeDiv.appendChild(templateCloseP);
      }
      if (typeArr[2] === "*") {
        const pointerP = document.createElement("p");
        pointerP.textContent = "*";
        memberTypeDiv.appendChild(pointerP);
      }
    };
    cookMemberType(member[memberName][0]);

    const memberNameButton = document.createElement("button");
    memberNameButton.classList.add("col-span-3", "text-left", "truncate");
    memberNameButton.textContent = member[memberName][0];

    const memberType = member[memberName][3];
    if (memberType === "C" || memberType === "S" || memberType === "E") {
      memberNameButton.classList.add("underline", "dark:decoration-gray-400");
      memberNameButton.addEventListener(
        "click",
        function (currentType, memberType) {
          if (currentType != memberType) {
            reloadWithNewCName(memberNameButton.textContent, memberType);
          } else displayCurrentType(memberNameButton.textContent);
        }.bind(null, currentType, memberType)
      );
    } else memberNameButton.classList.add("cursor-default");

    overviewMemberDiv.appendChild(memberTypeDiv);

    const memberNameDiv = document.createElement("div");
    memberNameDiv.classList.add("flex", "col-span-3", "space-x-3");

    const memberNameP = document.createElement("p");
    memberNameP.classList.add("truncate");
    memberNameP.textContent = memberName;

    if (fileVersion === 10201) {
      // version 1.02.01 has the : 1 within the name
    } else if (fileVersion === 10202) {
      // add : 1 if array size > 4 indicating bitfield
      if (member[memberName].length >= 5) {
        memberNameP.textContent += " : 1";
      }
      // if the arrayDim is > 1 display an C Style array
      if (member[memberName][3] > 1)
        memberNameP.textContent += " [" + member[memberName][3] + "]";
    }

    memberNameDiv.appendChild(memberNameP);

    if (Object.keys(UrlParams).length === 4) {
      if (memberName === UrlParams["member"]) {
        overviewMemberDiv.classList.add("bg-sky-400/10");
        focusFound = true;
      }
    }

    const memberLinkButton = document.createElement("button");
    memberLinkButton.classList.add(
      "text-gray-500",
      "dark:text-gray-400",
      "hover:text-blue-500",
      "dark:hover:text-blue-500",
      "hidden"
    );
    memberLinkButton.addEventListener(
      "click",
      function (bakedString) {
        navigator.clipboard.writeText(bakedString);
        showToast("Copied link to clipboard!", false);
      }.bind(
        null,
        window.location.href.split("&member")[0] +
          "&member=" +
          memberName.replace(/ /g, "%20")
      )
    );
    var linkSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    linkSVG.setAttribute("width", "20");
    linkSVG.setAttribute("height", "20");
    linkSVG.setAttribute("viewBox", "0 0 24 24");
    linkSVG.setAttribute("fill", "none");

    // Create the path element
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M14 7H16C18.7614 7 21 9.23858 21 12C21 14.7614 18.7614 17 16 17H14M10 7H8C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10M8 12H16"
    );
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    // Append the path element to the SVG element
    linkSVG.appendChild(path);

    memberLinkButton.appendChild(linkSVG);
    memberNameDiv.appendChild(memberLinkButton);

    overviewMemberDiv.appendChild(memberNameDiv);

    const memberOffsetP = document.createElement("p");
    memberOffsetP.classList.add("col-span-1", "font-mono");
    memberOffsetP.textContent =
      "0x" + member[Object.keys(member)[0]][1].toString(16);

    if (fileVersion === 10201) {
      // version 1.02.01 has the : 1 within the name
      if (
        memberName.length > 4 &&
        memberName.charAt(memberName.length - 3) === ":"
      ) {
        memberOffsetP.textContent += " : " + member[memberName][3];
      }
    } else if (fileVersion === 10202) {
      if (member[memberName].length >= 5) {
        memberOffsetP.textContent += " : " + member[memberName][4];
      }
    }
    overviewMemberDiv.appendChild(memberOffsetP);

    const memberSizeP = document.createElement("p");
    memberSizeP.classList.add("col-span-1", "pl-8", "font-mono");
    const memberSizeVal = member[Object.keys(member)[0]][2];
    memberSizeP.textContent = memberSizeVal;
    if (memberSizeVal < 10) memberSizeP.textContent += "\u00A0";
    if (memberSizeVal < 100) memberSizeP.textContent += "\u00A0";

    overviewMemberDiv.appendChild(memberSizeP);

    overviewMemberDiv.addEventListener(
      "mouseover",
      function (button) {
        memberLinkButton.classList.remove("hidden");
      }.bind(null, memberLinkButton)
    );

    overviewMemberDiv.addEventListener(
      "mouseout",
      function (button) {
        memberLinkButton.classList.add("hidden");
      }.bind(null, memberLinkButton)
    );

    itemsOverviewDiv.appendChild(overviewMemberDiv);
    if (!focusFound) focusIdx++;
    else {
      memberItemHeight = overviewMemberDiv.getBoundingClientRect().height;
    }
  }
  if (focusFound) {
    const memberList = document.getElementById("member-list");
    const rect = memberList.getBoundingClientRect();

    document.getElementById("member-list").scrollTop =
      focusIdx * memberItemHeight -
      ((rect.height - memberItemHeight) / 2 - memberItemHeight / 2);
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
            "\nclass " +
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
    textAreaSDKText += "0x" + member[memberName][1].toString(16) + ";";

    textAreaSDKText += " // ";

    let cookMemberTypeText = (typeArr) => {
      var text = typeArr[0];
      if (typeArr[3].length > 0) {
        text += "<";
        var i = 0;
        for (const submember of typeArr[3]) {
          text += cookMemberTypeText(submember);
          if (i < typeArr[3].length - 1) {
            text += ", ";
          }
          i++;
        }
        text += ">";
      }
      if (typeArr[2] === "*") {
        text += "*";
      }
      return text;
    };
    textAreaSDKText += cookMemberTypeText(member[memberName][0]);

    //type of the member

    if (isBitMember) textAreaSDKText += " : 1 (" + member[memberName][3] + ")";
    textAreaSDKText += "\n";
    textAreaSDKRows++;

    //create a new one for shenanigans with the length
    var _textAreaMDKText = "	" + member[memberName][0][1] + "Member(";

    _textAreaMDKText += cookMemberTypeText(member[memberName][0]);
    _textAreaMDKText += ")";
    //format it good aligned
    while (_textAreaMDKText.length < 54) {
      _textAreaMDKText += " ";
    }
    _textAreaMDKText += _memberName;
    while (_textAreaMDKText.length < 114) {
      _textAreaMDKText += " ";
    }
    _textAreaMDKText += "OFFSET(get";
    if (member[memberName][0][1] == "C") {
      _textAreaMDKText += "<T>, ";
    } else if (member[memberName][0][1] == "S") {
      _textAreaMDKText += "Struct<T>, ";
    } else if (member[memberName][0][1] == "D") {
      _textAreaMDKText += "<" + member[memberName][0][0] + ">, ";
    }
    _textAreaMDKText += "{" + "0x" + member[memberName][1].toString(16) + ", ";
    _textAreaMDKText += member[memberName][2] + ", ";
    if (isBitMember) _textAreaMDKText += "1, " + member[memberName][3] + "})\n";
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

        superButton.addEventListener(
          "click",
          function (superClass) {
            displayCurrentType(superClass);
          }.bind(null, superClass)
        );
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

  if (document.getElementById("class-list-name") != null) {
    document.getElementById("class-list-name").textContent =
      currentType === "C" ? "Classes" : "Structs";
  }

  if (document.getElementById("class-skeleton") != null) {
    document.getElementById("class-skeleton").remove();
  }
}

function displayEnums(CName, data) {
  //remove all children, in function viewer everything works different
  const itemsOverviewDiv = document.getElementById("overview-items");
  while (itemsOverviewDiv.firstChild) {
    itemsOverviewDiv.removeChild(itemsOverviewDiv.firstChild);
  }

  //get the actual array of the cname
  const enumItems = data[Object.keys(data)[0]][0];
  //now this is some next level shit, get the first index of the items,
  //then get the array of the first item and then get the second item which is uint8_t or smth
  const enumType = data[Object.keys(data)[0]][1];
  console.log("type: " + enumType);

  const coreDiv = document.createElement("div");
  coreDiv.classList.add(
    "py-2",
    "px-4",
    "text-slate-700",
    "dark:text-slate-100"
  );

  const enumDiv = document.createElement("div");
  enumDiv.classList.add("flex", "flex-wrap", "items-center", "justify-between");

  const enumHeaderDiv = document.createElement("div");
  enumHeaderDiv.classList.add("flex", "space-x-2");

  const enumNameP = document.createElement("p");
  enumNameP.textContent = "enum class " + CName;
  enumNameP.classList.add(
    "text-ellipsis",
    "overflow-hidden",
    "truncate",
    "sm:max-w-prose"
  );

  const enumTypeP = document.createElement("p");
  enumTypeP.textContent = ": " + enumType;
  enumTypeP.classList.add("text-slate-600", "dark:text-slate-400");

  const enumOpen = document.createElement("p");
  enumOpen.textContent = "{";

  enumHeaderDiv.appendChild(enumNameP);
  enumHeaderDiv.appendChild(enumTypeP);
  enumHeaderDiv.appendChild(enumOpen);

  const enumCopyButton = document.createElement("button");

  enumCopyButton.classList.add(
    "flex",
    "items-center",
    "bg-blue-700",
    "hover:bg-blue-500",
    "py-2",
    "px-4",
    "rounded-md",
    "text-white"
  );

  const svgCopyButton = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  svgCopyButton.setAttribute("width", "20");
  svgCopyButton.setAttribute("height", "20");
  svgCopyButton.setAttribute("viewBox", "0 0 24 24");
  svgCopyButton.setAttribute("stroke", "white");
  svgCopyButton.setAttribute("fill", "none");

  const pathCopyButton = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  pathCopyButton.setAttribute(
    "d",
    "M17.5 14H19C20.1046 14 21 13.1046 21 12V5C21 3.89543 20.1046 3 19 3H12C10.8954 3 10 3.89543 10 5V6.5M5 10H12C13.1046 10 14 10.8954 14 12V19C14 20.1046 13.1046 21 12 21H5C3.89543 21 3 20.1046 3 19V12C3 10.8954 3.89543 10 5 10Z"
  );
  pathCopyButton.setAttribute("stroke-width", "1.5");
  pathCopyButton.setAttribute("stroke-linecap", "round");
  pathCopyButton.setAttribute("stroke-linejoin", "round");

  svgCopyButton.appendChild(pathCopyButton);
  enumCopyButton.appendChild(svgCopyButton);

  var bakedString = enumNameP.textContent + enumTypeP.textContent + " {\n";
  for (const enu of enumItems) {
    const enun = Object.keys(enu);
    bakedString += "  " + enun + " = " + enu[enun] + ", \n";
  }
  bakedString = bakedString.slice(0, -3);
  bakedString += "\n};";
  enumCopyButton.addEventListener(
    "click",
    function (bakedString) {
      navigator.clipboard.writeText(bakedString);
      showToast("Copied enum to clipboard!", false);
    }.bind(null, bakedString)
  );

  enumDiv.appendChild(enumHeaderDiv);

  enumDiv.appendChild(enumCopyButton);

  const enumFooterDiv = document.createElement("div");
  enumFooterDiv.classList.add("grid", "grid-cols-8", "mx-10");
  var enuItemCount = 0;
  for (const _enu of enumItems) {
    const enu = _enu[Object.keys(_enu)];
    const enuItemNameP = document.createElement("p");
    enuItemNameP.classList.add(
      "col-span-7",
      "sm:col-span-6",
      "text-left",
      "truncate"
    );
    enuItemNameP.textContent = Object.keys(_enu);
    enumFooterDiv.appendChild(enuItemNameP);
    const enuItemValueP = document.createElement("p");
    enuItemValueP.classList.add("col-span-1", "sm:col-span-2");

    if (enuItemCount < enumItems.length - 1)
      enuItemValueP.textContent = "= " + enu + ",";
    else enuItemValueP.textContent = "= " + enu;

    enumFooterDiv.appendChild(enuItemValueP);
    enuItemCount++;
  }

  const enumClosureP = document.createElement("p");
  enumClosureP.textContent = "};";

  coreDiv.appendChild(enumDiv);
  coreDiv.appendChild(enumFooterDiv);
  coreDiv.appendChild(enumClosureP);

  itemsOverviewDiv.appendChild(coreDiv);

  if (document.getElementById("class-desc-name") !== null)
    document.getElementById("class-desc-name").textContent = CName;

  if (document.getElementById("class-list-name") != null) {
    document.getElementById("class-list-name").textContent = "Enums";
  }

  //theres only one tab available
  if (document.getElementById("selection-tabs") != null) {
    document.getElementById("selection-tabs").remove();
  }

  if (document.getElementById("class-skeleton") != null) {
    document.getElementById("class-skeleton").remove();
  }

  if (document.getElementById("overview-items-skeleton") != null) {
    document.getElementById("overview-items-skeleton").remove();
  }
}

function displayFunctions(CName, data) {
  //remove all children, in function viewer everything works different
  const itemsOverviewDiv = document.getElementById("overview-items");
  while (itemsOverviewDiv.firstChild) {
    itemsOverviewDiv.removeChild(itemsOverviewDiv.firstChild);
  }

  const funcs = data[Object.keys(data)[0]];

  var moveTo = 0;
  for (const func of funcs) {
    const funcName = Object.keys(func)[0];

    const coreDiv = document.createElement("div");
    coreDiv.classList.add(
      "border-b",
      "border-gray-200",
      "dark:border-gray-600",
      "py-2",
      "px-4",
      "text-slate-700",
      "dark:text-slate-100"
    );

    const offsetDiv = document.createElement("div");
    offsetDiv.classList.add("flex", "space-x-4");
    const offsetP = document.createElement("p");
    offsetP.classList.add("text-slate-600", "dark:text-slate-400");
    offsetP.textContent = "Function offset:";
    const offsetButton = document.createElement("button");
    offsetButton.classList.add(
      "transition",
      "duration-200",
      "ease-in-out",
      "hover:text-blue-500"
    );
    offsetButton.textContent = "0x" + func[funcName][2].toString(16);
    offsetButton.addEventListener(
      "click",
      function (textContent) {
        navigator.clipboard.writeText(textContent);
        showToast("Copied offset to clipboard!", false);
      }.bind(null, offsetButton.textContent)
    );
    const functionFlags = document.createElement("p");
    functionFlags.classList.add(
      "text-slate-600",
      "dark:text-slate-400",
      "pl-4",
      "truncate"
    );
    functionFlags.textContent = func[funcName][3];

    offsetDiv.appendChild(offsetP);
    offsetDiv.appendChild(offsetButton);
    offsetDiv.appendChild(functionFlags);

    const functionLinkButton = document.createElement("button");
    functionLinkButton.classList.add(
      "text-gray-500",
      "dark:text-gray-400",
      "hover:text-blue-500",
      "dark:hover:text-blue-500",
      "hidden"
    );
    functionLinkButton.addEventListener(
      "click",
      function (bakedString) {
        navigator.clipboard.writeText(bakedString);
        showToast("Copied link to clipboard!", false);
      }.bind(
        null,
        window.location.href.split("&member")[0] +
          "&member=" +
          funcName.replace(/ /g, "%20")
      )
    );
    var linkSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    linkSVG.setAttribute("width", "20");
    linkSVG.setAttribute("height", "20");
    linkSVG.setAttribute("viewBox", "0 0 24 24");
    linkSVG.setAttribute("fill", "none");

    // Create the path element
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M14 7H16C18.7614 7 21 9.23858 21 12C21 14.7614 18.7614 17 16 17H14M10 7H8C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10M8 12H16"
    );
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    // Append the path element to the SVG element
    linkSVG.appendChild(path);

    functionLinkButton.appendChild(linkSVG);
    offsetDiv.appendChild(functionLinkButton);

    coreDiv.appendChild(offsetDiv);

    coreDiv.addEventListener(
      "mouseover",
      function (button) {
        button.classList.remove("hidden");
      }.bind(null, functionLinkButton)
    );

    coreDiv.addEventListener(
      "mouseout",
      function (button) {
        button.classList.add("hidden");
      }.bind(null, functionLinkButton)
    );

    const functionDiv = document.createElement("div");
    functionDiv.classList.add(
      "flex",
      "items-center",
      "justify-between",
      "mr-4"
    );
    const functionHeaderDiv = document.createElement("div");
    functionHeaderDiv.classList.add("flex", "truncate");

    let cookMemberType = (typeArr, div) => {
      const memberTypeButton = document.createElement("button");
      memberTypeButton.classList.add("text-left", "truncate");
      memberTypeButton.textContent = typeArr[0];
      if (typeArr[1] === "C" || typeArr[1] === "S" || typeArr[1] === "E") {
        memberTypeButton.classList.add("underline", "dark:decoration-gray-400");
        memberTypeButton.addEventListener(
          "click",
          function (currentType, memberType, cname) {
            if (currentType != memberType) {
              reloadWithNewCName(cname, memberType);
            } else displayCurrentType(cname);
          }.bind(null, currentType, typeArr[1], typeArr[0])
        );
      } else memberTypeButton.classList.add("cursor-default");
      div.appendChild(memberTypeButton);
      if (typeArr[3].length > 0) {
        const templateOpenP = document.createElement("p");
        templateOpenP.textContent = "<";
        div.appendChild(templateOpenP);
        var i = 0;
        for (const submember of typeArr[3]) {
          cookMemberType(submember, div);
          if (i < typeArr[3].length - 1) {
            const commaP = document.createElement("p");
            commaP.classList.add("pr-1");
            commaP.textContent = ",";
            div.appendChild(commaP);
          }
          i++;
        }
        const templateCloseP = document.createElement("p");
        templateCloseP.textContent = ">";
        div.appendChild(templateCloseP);
      }
      if (typeArr[2] === "*") {
        const pointerP = document.createElement("p");
        pointerP.textContent = "*";
        div.appendChild(pointerP);
      }
    };
    cookMemberType(func[funcName][0], functionHeaderDiv);
    const funcParams = func[funcName][1];
    const funcNameP = document.createElement("p");
    funcNameP.classList.add("pl-2");
    if (funcParams.length > 0) funcNameP.textContent = funcName + "(";
    else funcNameP.textContent = funcName + "();";
    funcNameP.classList.add("text-ellipsis", "overflow-hidden", "truncate");
    functionHeaderDiv.appendChild(funcNameP);

    functionDiv.appendChild(functionHeaderDiv);

    const functionCopyButton = document.createElement("button");

    functionCopyButton.classList.add(
      "flex",
      "items-center",
      "bg-blue-700",
      "hover:bg-blue-500",
      "py-2",
      "px-4",
      "rounded-md",
      "text-white"
    );

    const svgCopyButton = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgCopyButton.setAttribute("width", "20");
    svgCopyButton.setAttribute("height", "20");
    svgCopyButton.setAttribute("viewBox", "0 0 24 24");
    svgCopyButton.setAttribute("stroke", "white");
    svgCopyButton.setAttribute("fill", "none");

    const pathCopyButton = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathCopyButton.setAttribute(
      "d",
      "M17.5 14H19C20.1046 14 21 13.1046 21 12V5C21 3.89543 20.1046 3 19 3H12C10.8954 3 10 3.89543 10 5V6.5M5 10H12C13.1046 10 14 10.8954 14 12V19C14 20.1046 13.1046 21 12 21H5C3.89543 21 3 20.1046 3 19V12C3 10.8954 3.89543 10 5 10Z"
    );
    pathCopyButton.setAttribute("stroke-width", "1.5");
    pathCopyButton.setAttribute("stroke-linecap", "round");
    pathCopyButton.setAttribute("stroke-linejoin", "round");

    svgCopyButton.appendChild(pathCopyButton);
    functionCopyButton.appendChild(svgCopyButton);

    let cookBakedString = (typeArr) => {
      var text = typeArr[0];
      if (typeArr[3].length > 0) {
        text += "<";
        var i = 0;
        for (const submember of typeArr[3]) {
          text += cookBakedString(submember);
          if (i < typeArr[3].length - 1) {
            text += ", ";
          }
          i++;
        }
        text += ">";
      }
      if (typeArr[2] === "*") {
        text += "*";
      }
      return text;
    };

    var bakedString = cookBakedString(func[funcName][0]) + " " + funcName + "(";

    for (const param of funcParams) {
      bakedString +=
        cookBakedString(param[0]) + param[1] + " " + param[2] + ", ";
    }
    if (funcParams.length > 0) bakedString = bakedString.slice(0, -2);
    bakedString += ");";
    functionCopyButton.addEventListener(
      "click",
      function (bakedString) {
        navigator.clipboard.writeText(bakedString);
        showToast("Copied function to clipboard!", false);
      }.bind(null, bakedString)
    );

    functionDiv.appendChild(functionCopyButton);

    coreDiv.appendChild(functionDiv);

    if (funcParams.length > 0) {
      const functionFooterDiv = document.createElement("div");
      functionFooterDiv.classList.add("grid", "grid-cols-8", "mx-10");
      var paramCount = 0;
      for (const param of funcParams) {
        const functionParamDiv = document.createElement("div");
        functionParamDiv.classList.add("flex", "col-span-4");
        cookMemberType(param[0], functionParamDiv);
        const additionaltype = document.createElement("p");
        additionaltype.textContent = param[1];
        functionParamDiv.appendChild(additionaltype);

        functionFooterDiv.appendChild(functionParamDiv);

        const functionParamNameP = document.createElement("p");
        functionParamNameP.classList.add("col-span-4", "pl-4");

        if (paramCount < funcParams.length - 1)
          functionParamNameP.textContent = param[2] + ",";
        else functionParamNameP.textContent = param[2];

        functionFooterDiv.appendChild(functionParamNameP);
        paramCount++;
      }
      coreDiv.appendChild(functionFooterDiv);
      const functionClosureP = document.createElement("p");
      functionClosureP.textContent = ");";
      coreDiv.appendChild(functionClosureP);
    }
    itemsOverviewDiv.appendChild(coreDiv);
    if (Object.keys(UrlParams).length === 4) {
      if (funcName === UrlParams["member"]) {
        coreDiv.classList.add("bg-sky-400/10");
        focusFound = true;
        moveTo = coreDiv.offsetTop;
      }
    }
  }

  if (moveTo > 0) {
    document.getElementById("member-list").scrollTop =
      moveTo -
      document.getElementById("member-list").getBoundingClientRect().height / 2;
  }

  if (document.getElementById("class-desc-name") !== null)
    document.getElementById("class-desc-name").textContent = CName;

  if (document.getElementById("class-list-name") != null) {
    document.getElementById("class-list-name").textContent = "Functions";
  }

  //theres only one tab available
  if (document.getElementById("selection-tabs") != null) {
    document.getElementById("selection-tabs").remove();
  }

  if (document.getElementById("class-skeleton") != null) {
    document.getElementById("class-skeleton").remove();
  }

  if (document.getElementById("overview-items-skeleton") != null) {
    document.getElementById("overview-items-skeleton").remove();
  }
}

function showOverview() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (itemOverview != null) itemOverview.classList.remove("hidden");
  if (itemClickDiv != null)
    itemClickDiv.classList.add("bg-gray-50", "dark:bg-slate-800");

  if (structOverview != null) structOverview.classList.add("hidden");
  if (structClickDiv != null)
    structClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");

  if (MDKOverview != null) MDKOverview.classList.add("hidden");
  if (MDKClickDiv != null)
    MDKClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");
}

function showStruct() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (structOverview != null) structOverview.classList.remove("hidden");
  if (structClickDiv != null)
    structClickDiv.classList.add("bg-gray-50", "dark:bg-slate-800");

  if (itemOverview != null) itemOverview.classList.add("hidden");
  if (itemClickDiv != null)
    itemClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");

  if (MDKOverview != null) MDKOverview.classList.add("hidden");
  if (MDKClickDiv != null)
    MDKClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");
}

function showMDK() {
  var itemOverview = document.getElementById("overview-items");
  var itemClickDiv = document.getElementById("overview-click-div");
  var structOverview = document.getElementById("struct-items");
  var structClickDiv = document.getElementById("struct-click-div");
  var MDKOverview = document.getElementById("MDK-items");
  var MDKClickDiv = document.getElementById("mdk-click-div");

  if (MDKOverview != null) MDKOverview.classList.remove("hidden");
  if (MDKClickDiv != null)
    MDKClickDiv.classList.add("bg-gray-50", "dark:bg-slate-800");

  if (structOverview != null) structOverview.classList.add("hidden");
  if (structClickDiv != null)
    structClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");

  if (itemOverview != null) itemOverview.classList.add("hidden");
  if (itemClickDiv != null)
    itemClickDiv.classList.remove("bg-gray-50", "dark:bg-slate-800");
}

function showOffsets(credit, dataJSON) {
  document.title = "Dumpspace - " + gameName;
  document.getElementById("dumpspace-text").textContent = document.title;

  //document.getElementById("offset-announcement").classList.remove("hidden");

  const viewer = document.getElementById("full-viewer");
  while (viewer.firstChild) {
    viewer.removeChild(viewer.firstChild);
  }
  viewer.classList.remove(
    "xl:grid",
    "xl:grid-cols-4",
    "xl:gap-4",
    "xl:px-32",
    "px-4",
    "top-10"
  );
  viewer.classList.add("xl:px-64", "md:px-32", "px-8");
  const fullOffsetDiv = document.createElement("div");
  fullOffsetDiv.classList.add(
    "border",
    "py-4",
    "my-16",
    "px-4",
    "rounded-lg",
    "border-gray-200",
    "dark:border-gray-600",
    "text-slate-700",
    "dark:text-slate-100"
  );
  for (const offset of dataJSON) {
    const offsetDiv = document.createElement("div");
    offsetDiv.classList.add(
      "border-b",
      "border-gray-200",
      "dark:border-gray-600",
      "flex",
      "justify-between",
      "py-3"
    );
    const offsetNameP = document.createElement("p");
    offsetNameP.classList.add("self-center", "font-semibold");
    offsetNameP.textContent = offset[0];

    const offsetNumP = document.createElement("p");
    offsetNumP.classList.add("self-center", "pr-4");
    offsetNumP.textContent = "0x" + offset[1].toString(16);

    const rightSideDiv = document.createElement("div");
    rightSideDiv.classList.add("flex");
    const offsetCopyButton = document.createElement("button");

    offsetCopyButton.classList.add(
      "flex",
      "items-center",
      "bg-blue-700",
      "hover:bg-blue-500",
      "py-2",
      "px-4",
      "rounded-md",
      "text-white"
    );

    const svgCopyButton = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgCopyButton.setAttribute("width", "20");
    svgCopyButton.setAttribute("height", "20");
    svgCopyButton.setAttribute("viewBox", "0 0 24 24");
    svgCopyButton.setAttribute("stroke", "white");
    svgCopyButton.setAttribute("fill", "none");

    const pathCopyButton = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathCopyButton.setAttribute(
      "d",
      "M17.5 14H19C20.1046 14 21 13.1046 21 12V5C21 3.89543 20.1046 3 19 3H12C10.8954 3 10 3.89543 10 5V6.5M5 10H12C13.1046 10 14 10.8954 14 12V19C14 20.1046 13.1046 21 12 21H5C3.89543 21 3 20.1046 3 19V12C3 10.8954 3.89543 10 5 10Z"
    );
    pathCopyButton.setAttribute("stroke-width", "1.5");
    pathCopyButton.setAttribute("stroke-linecap", "round");
    pathCopyButton.setAttribute("stroke-linejoin", "round");

    svgCopyButton.appendChild(pathCopyButton);
    offsetCopyButton.appendChild(svgCopyButton);

    const bakedString =
      "constexpr auto " +
      offset[0] +
      " = " +
      "0x" +
      offset[1].toString(16) +
      ";";

    offsetCopyButton.addEventListener(
      "click",
      function (bakedString) {
        navigator.clipboard.writeText(bakedString);
        showToast("Copied offset to clipboard!", false);
      }.bind(null, bakedString)
    );

    offsetDiv.appendChild(offsetNameP);

    rightSideDiv.appendChild(offsetNumP);
    rightSideDiv.appendChild(offsetCopyButton);
    offsetDiv.appendChild(rightSideDiv);

    fullOffsetDiv.appendChild(offsetDiv);
  }
  viewer.appendChild(fullOffsetDiv);
  if (credit !== undefined) {
    const creditDiv = document.createElement("div");
    creditDiv.classList.add(
      "self-center",
      "font-semibold",
      "text-slate-700",
      "dark:text-slate-100",
      "-my-16",
      "px-2",
      "pb-16",
      "transition",
      "duration-200",
      "ease-in-out",
      "hover:text-blue-500"
    );
    const creditA = document.createElement("a");
    creditA.textContent = "Created By " + credit.dumper_used;
    creditA.href = credit.dumper_link;
    creditDiv.appendChild(creditA);
    viewer.appendChild(creditDiv);
  }
}

if (
  Object.keys(UrlParams).length === 0 ||
  Object.keys(UrlParams)[0] !== "hash" ||
  (UrlParams["hash"].length !== 16 && UrlParams["hash"].length !== 8)
) {
  returnHome();
}

//fix when the games folder is first downloaded classes are listed by default
if (Object.keys(UrlParams).length === 1) {
  getGameInfo("classes", false, false, false);
}

//add reload listener
window.addEventListener("popstate", function () {
  var oldParams = getUrlParams(currentURL);
  var newParams = getUrlParams();
  console.log(
    "viewer changed from type " +
      oldParams[Object.keys(oldParams)[1]] +
      " -> " +
      newParams[Object.keys(newParams)[1]]
  );
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
  ) {
    location.reload();
    return;
  }

  console.log("page reload was not needed!");
  displayCurrentType(newParams[Object.keys(newParams)[2]]);
});

//display! yay!
displayCurrentGame();

const toastDiv = document.getElementById("toast-div");
const toastCheck = document.getElementById("toast-check");
const toastError = document.getElementById("toast-error");
const toastDivText = document.getElementById("toast-div-text");

toastDiv.addEventListener("click", function () {
  // Show the floating div
  toastDiv.classList.remove("opacity-100");
  toastDiv.classList.add("opacity-0");
});

document.getElementById("copy-url").addEventListener("click", function () {
  navigator.clipboard.writeText(window.location.href);
  showToast("Copied URL to clipboard!", false);
});

function showToast(name, error = true) {
  if (toastDiv != null) {
    toastDiv.classList.remove("opacity-0");
  }
  toastDiv.classList.add("opacity-100");

  if (toastDivText != null) toastDivText.textContent = name;

  if (error) {
    toastCheck.classList.add("hidden");
    toastError.classList.remove("hidden");
  } else {
    toastError.classList.add("hidden");
    toastCheck.classList.remove("hidden");
  }
}

const searchInput = document.getElementById("class-search-input");
const searchCancelButton = document.getElementById("search-cancel-button");

function handleSearchInput() {
  var filter = searchInput.value.toUpperCase();
  var formattedArrayDataRef = [];
  if (filter.length > 0) {
    searchCancelButton.classList.remove("hidden");
  } else searchCancelButton.classList.add("hidden");
  if (filter === "") {
    formattedArrayDataRef = formattedArrayData;
  } else {
    for (i = 0; i < formattedArrayData.length; i++) {
      if (formattedArrayData[i].toUpperCase().includes(filter) === true) {
        formattedArrayDataRef.push(formattedArrayData[i]);
      }
    }
  }
  dVanillaRecyclerView.setData(formattedArrayDataRef);
  dVanillaRecyclerView.calculateSize();

  classDiv.scrollTop = 0;
}
searchCancelButton.addEventListener("click", function () {
  searchInput.value = "";
  handleSearchInput();
});

document
  .getElementById("ClassesButton")
  .addEventListener("mouseup", function (event) {
    getGameInfo("classes", true, event.button === 1);
  });
document
  .getElementById("StructsButton")
  .addEventListener("mouseup", function (event) {
    getGameInfo("structs", true, event.button === 1);
  });
document
  .getElementById("FunctionsButton")
  .addEventListener("mouseup", function (event) {
    getGameInfo("functions", true, event.button === 1);
  });
document
  .getElementById("EnumsButton")
  .addEventListener("mouseup", function (event) {
    getGameInfo("enums", true, event.button === 1);
  });
document
  .getElementById("OffsetsButton")
  .addEventListener("mouseup", function (event) {
    getGameInfo("offsets", true, event.button === 1);
  });

document.body.onmousedown = function (e) {
  if (e.button === 1) return false;
};

function findInheritances(name) {
  const inheritances = [];
  for (const gameClass of currentInfoJson.data) {
    const info = Object.keys(gameClass)[0];
    const inheritInfo = gameClass[info][0]["__InheritInfo"];
    if (inheritInfo.length > 0 && inheritInfo[0] === name) {
      inheritances.push(info);
    }
  }
  return inheritances;
}

function toggleInheritanceView() {
  document.getElementById("InheritanceViewerDiv").classList.toggle("hidden");
  handleInheritanceView();
}

function handleInheritanceView() {
  const innerDiv = document.getElementById("InheritanceViewerInnerDiv");
  const innerIdleDiv = document.getElementById("InheritanceViewer-spinner");
  innerDiv.classList.add("hidden");
  innerIdleDiv.classList.remove("hidden");

  const selectedRadio = document.querySelector(
    'input[name="inherit-depth-radio"]:checked'
  );
  const selectedValue = Number(
    document.querySelector(`label[for="${selectedRadio.id}"]`).textContent || 0
  );
  console.log(`select: ${selectedValue}`);

  innerDiv.textContent = "";
  const search = document.getElementById("class-desc-name").textContent;
  const names = [];
  let mermaidDefinition = "graph LR\n";

  function addInstances(inher, i) {
    for (const inher2 of findInheritances(inher)) {
      mermaidDefinition += `${inher} --> ${inher2}\n`;
      if (i > 0) {
        addInstances(inher2, i - 1);
      }
    }
  }

  addInstances(search, selectedValue - 1);

  innerDiv.innerHTML = mermaidDefinition;

  innerDiv.classList.add("mermaid");
  //console.log(mermaidDefinition);
  innerDiv.removeAttribute("data-processed");
  mermaid.contentLoaded();
  innerDiv.classList.remove("hidden");
  innerIdleDiv.classList.add("hidden");
}
mermaid.initialize({
  startOnLoad: true,
  maxTextSize: 200000,
  theme: "default",
  themeVariables: {
    fontFamily: "Inter, sans-serif",
    lineColor: "#1d4ed8",
  },
});
