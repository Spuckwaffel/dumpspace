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
var UrlParams = getUrlParams();
var currentURL = window.location.href;

//sets a valid url with params for the target game
function getGameInfo(info, reload = true) {
  if (Object.keys(UrlParams).length == 0) return;

  if (Object.keys(UrlParams)[0] != "hash") return;
  var newURL = window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  newURL += "hash=" + UrlParams["hash"];

  history.pushState(null, null, newURL + "&type=" + info);

  console.log("[getGameInfo] pushing " + newURL + "&type=" + info);

  if (reload) location.reload();

  UrlParams = getUrlParams();
}

//reloads the website with the CName and its type (C,S,D,E)
//only call if the current type does not match the new type
function reloadWithNewCName(CName, newType) {
  //params always need hash and type
  if (Object.keys(UrlParams).length < 2) return;

  //no hash?
  if (Object.keys(UrlParams)[0] != "hash") return;

  //not supported type param?
  if (
    Object.keys(UrlParams)[1] != "type" ||
    (UrlParams["type"] != "classes" &&
      UrlParams["type"] != "structs" &&
      UrlParams["type"] != "functions")
  )
    return;

  if (newType == null) return;

  var newURL = window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  newURL += "hash=" + UrlParams["hash"];

  //remove pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  console.log("received type " + newType);

  if (newType === "C") newURL += "&type=classes";
  else if (newType === "S") newURL += "&type=structs";
  else if (newType === "F") newURL += "&type=functions";

  console.log("[reloadWithNewCName] pushing " + newURL + "&idx=" + CName);
  history.pushState(null, null, newURL + "&idx=" + CName);
  // Reload the page to apply the changes
  location.reload();
}

//error? go to home page
function returnHome() {
  history.pushState(null, null, window.location.origin);
  //console.log("returnHome called? Unexpected issue?");
  //throw e;
  location.reload();
}

//make sure this is always valid
const classDiv = document.getElementById("class-list");
const classDivScroll = document.getElementById("class-list-scroll");

if (classDivScroll.offsetHeight == 256)
  classDivScroll.style.height = 500 + "px";

classDiv.style.height = classDiv.offsetHeight + "px";
classDiv.style.width = "100%";
console.log(classDiv.style.height);

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
    (UrlParams["type"] != "classes" &&
      UrlParams["type"] != "structs" &&
      UrlParams["type"] != "functions")
  )
    returnHome();

  const game = await getGameByHash(UrlParams["hash"]);
  //no game found for hash? go back
  if (game == null) returnHome();

  const gameDirectory = game.engine + "/" + game.location + "/";

  console.log(
    "crunching latest data for: " + gameDirectory + " - " + UrlParams["type"]
  );

  if (UrlParams["type"] === "classes") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "ClassesInfo.json.gz",
      game.uploaded
    );
    CurrentInfoJson = JSON.parse(response);
    currentType = "C";
  } else if (UrlParams["type"] === "structs") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "StructsInfo.json.gz",
      game.uploaded
    );
    CurrentInfoJson = JSON.parse(response);
    currentType = "S";
  } else if (UrlParams["type"] === "functions") {
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "FunctionsInfo.json.gz",
      game.uploaded
    );
    CurrentInfoJson = JSON.parse(response);
    currentType = "F";
  }

  console.log(CurrentInfoJson);
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

  displayCurrentType(targetClassName);
}

var oldFocussedDataDiv = null;
var formattedArrayDataValid = false;
var formattedArrayData = [];
var dVanillaRecyclerView = null;
//only works on current data, if different type than current, call reloadwithnewdata
function displayCurrentType(CName) {
  console.log("trying to display " + CName);
  //fixup cnames having pointers
  if (CName.charAt(CName.length - 1) === "*") {
    CName = CName.slice(0, -1);
  }

  //url specific stuff for history

  // no matter what, reset the url params
  var newURL = "?hash=" + UrlParams["hash"];

  if (currentType === "C") newURL += "&type=classes";
  else if (currentType === "S") newURL += "&type=structs";
  else if (currentType === "F") newURL += "&type=functions";

  newURL += "&idx=" + CName;

  const oldURL = currentURL;
  currentURL = window.location.origin + window.location.pathname + newURL;
  UrlParams = getUrlParams(newURL);

  //only needed on website refresh
  var scrollToIdx = 0;

  var targetIndexData = null;

  var idx = 0;
  for (const gameClass of CurrentInfoJson.data) {
    idx++;
    if (!formattedArrayDataValid)
      formattedArrayData.push(Object.keys(gameClass)[0]);

    if (CName !== null && Object.keys(gameClass)[0] === CName) {
      scrollToIdx = idx;
      targetIndexData = gameClass;
    }
  }

  //
  if (targetIndexData == null) {
    if (CName != Object.keys(CurrentInfoJson.data[0])[0]) {
      console.log("could not find " + CName);
      showToast("Could not find type " + CName + "!");
      //go back to older one that worked
      const paramsBefore = getUrlParams("." + oldURL.split("?")[1]);
      //guaranteed to be valid
      if (oldURL === currentURL)
        displayCurrentType(Object.keys(CurrentInfoJson.data[0])[0]);
      else displayCurrentType(paramsBefore[Object.keys(paramsBefore)[2]]);
      return;
    }
  }

  //now we can push, the entry is valid. we do this to not push invalid shit
  if (window.location.href !== currentURL) {
    console.log("pushed " + currentURL + " to history");
    history.pushState(null, "", currentURL);
  }

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
            displayCurrentType(params.data);
          });
        }
        getLayout() {
          return this.layout;
        }
        onUnmount() {}
      },
    });

    if (scrollToIdx > 0) {
      // calculating the box with a fixed size of 50px lol
      const scrollTo = scrollToIdx * 50 + 200;

      // Scroll the container to center the button
      //classDiv.style.scrollBehavior = "smooth";
      classDiv.scrollTop = scrollTo;
    }
    formattedArrayDataValid = true;
  }

  if (currentType === "C" || currentType === "S")
    displayMembers(CName, targetIndexData);
  if (currentType === "F") displayFunctions(CName, targetIndexData);
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

    const memberNameButton = document.createElement("button");
    memberNameButton.classList.add("col-span-3", "text-left", "truncate");
    memberNameButton.textContent = member[Object.keys(member)[0]][0];

    const memberType = member[Object.keys(member)[0]][3];
    if (memberType === "C" || memberType === "S") {
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

function displayFunctions(CName, data) {
  //remove all children, in function viewer everything works different
  const itemsOverviewDiv = document.getElementById("overview-items");
  while (itemsOverviewDiv.firstChild) {
    itemsOverviewDiv.removeChild(itemsOverviewDiv.firstChild);
  }

  const funcs = data[Object.keys(data)[0]];

  for (const func of funcs) {
    const funcName = Object.keys(func)[0];
    console.log(funcName);
    for (const item of func[funcName]) {
      console.log(item);
    }

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
    offsetButton.textContent = "0x" + func[funcName][3].toString(16);
    offsetButton.addEventListener(
      "click",
      function (textContent) {
        navigator.clipboard.writeText(textContent);
        showToast("Copied offset to clipboard!", false);
      }.bind(null, offsetButton.textContent)
    );
    offsetDiv.appendChild(offsetP);
    offsetDiv.appendChild(offsetButton);
    coreDiv.appendChild(offsetDiv);
    const functionDiv = document.createElement("div");
    functionDiv.classList.add(
      "flex",
      "flex-wrap",
      "items-center",
      "justify-between",
      "mr-4"
    );
    const functionHeaderDiv = document.createElement("div");
    functionHeaderDiv.classList.add("flex", "space-x-3", "truncate");
    const returnType = func[funcName][0];
    const returnSpecType = func[funcName][1];
    const funcParams = func[funcName][2];
    if (returnSpecType !== "D") {
      const returnTypeButton = document.createElement("button");
      //we call from function page, it can only be class or struct
      returnTypeButton.addEventListener(
        "click",
        function (CName, Type) {
          reloadWithNewCName(CName, Type);
        }.bind(null, returnType, returnSpecType)
      );
    } else {
      const returnTypeP = document.createElement("p");
      returnTypeP.textContent = returnType;
      functionHeaderDiv.appendChild(returnTypeP);
    }
    const funcNameP = document.createElement("p");
    if (funcParams.length > 0) funcNameP.textContent = funcName + "(";
    else funcNameP.textContent = funcName + "();";
    funcNameP.classList.add(
      "text-ellipsis",
      "overflow-hidden",
      "truncate",
      "sm:max-w-prose"
    );
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

    var bakedString = returnType + " " + funcName + "(";
    for (const param of funcParams) {
      bakedString += param[0] + " " + param[1] + ", ";
    }
    bakedString = bakedString.slice(0, -2);
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
        if (param[2] !== "D") {
          const functionParamButton = document.createElement("button");
          functionParamButton.classList.add(
            "col-span-2",
            "transition",
            "duration-200",
            "ease-in-out",
            "hover:text-blue-500",
            "text-left",
            "truncate"
          );
          functionParamButton.textContent = param[0];
          functionParamButton.addEventListener(
            "click",
            function (paramCName, paramType) {
              reloadWithNewCName(paramCName, paramType);
            }.bind(null, param[0], param[2])
          );
          functionFooterDiv.appendChild(functionParamButton);
        } else {
          const functionParamP = document.createElement("p");
          functionParamP.classList.add("col-span-2", "text-left");
          functionParamP.textContent = param[0];
          functionFooterDiv.appendChild(functionParamP);
        }
        const functionParamNameP = document.createElement("p");
        functionParamNameP.classList.add("col-span-5");

        if (paramCount < funcParams.length - 1)
          functionParamNameP.textContent = param[1] + ",";
        else functionParamNameP.textContent = param[1];

        functionFooterDiv.appendChild(functionParamNameP);
        paramCount++;
      }
      coreDiv.appendChild(functionFooterDiv);
      const functionClosureP = document.createElement("p");
      functionClosureP.textContent = ");";
      coreDiv.appendChild(functionClosureP);
    }
    itemsOverviewDiv.appendChild(coreDiv);
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

if (
  Object.keys(UrlParams).length === 0 ||
  Object.keys(UrlParams)[0] !== "hash" ||
  UrlParams["hash"].length !== 16
) {
  returnHome();
}

if (Object.keys(UrlParams).length === 1) {
  getGameInfo("classes", false);
}

//add reload listener
window.addEventListener("popstate", function () {
  var oldParams = getUrlParams(currentURL);
  var newParams = getUrlParams();
  console.log(
    oldParams[Object.keys(oldParams)[1]] +
      ":" +
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
}
searchCancelButton.addEventListener("click", function () {
  searchInput.value = "";
  handleSearchInput();
});
