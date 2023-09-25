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
  if (info.charAt(info.length - 1) === "*") {
    info = info.slice(0, -1);
  }
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

    //target class name for further actions
    var targetClassName,
      targetClassItem = null;

    //the target class with data (there should be always a target class, if not stuff aint right)
    var targetClassData = null;
    //either get a current focussed class
    if (
      Object.keys(params).length === 3 &&
      Object.keys(params)[2] === "class"
    ) {
      targetClassName = params["class"];
      //or select the first one as default
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
        targetClassData = gameClass;
        //for (const item of gameClass.Object.keys(gameClass)) console.log(item);
        targetClassItem = classButton;
        classButton.classList.add("bg-gray-600/10");
      }
    }

    //scroll to the targeted class
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

    if (targetClassData != null) {
      var members = targetClassData[Object.keys(targetClassData)[0]];
      if (document.getElementById("class-desc-name") != null)
        document.getElementById("class-desc-name").textContent =
          targetClassName;
      var itemOverview = document.getElementById("overview-items");
      var classInheritDiv = document.getElementById("class-desc-inherits");

      var textAreaSDKRows = 0;
      var textAreaMDKRows = 0;
      var textAreaSDKText = "// Inheritance: ";
      var textAreaMDKText = "";

      //the inherit info shit
      for (var member of members) {
        //check if member is
        const entryName = Object.keys(member)[0];
        if (entryName === "__InheritInfo") {
          //some var we increase used for the >
          var l = 0;
          //iterate though it
          for (const superClass of member["__InheritInfo"]) {
            const superButton = document.createElement("button");
            superButton.addEventListener("click", function () {
              getClassInfo(superClass);
            });
            superButton.classList.add(
              "transition",
              "duration-200",
              "ease-in-out",
              "hover:text-blue-500"
            );
            superButton.textContent = superClass;

            if (l == 0) {
              textAreaMDKText =
                "class " +
                targetClassName +
                " : public " +
                superClass +
                "\n{\n	friend MDKHandler;\n";

              textAreaMDKRows += 3;
            }

            textAreaSDKText += superClass;

            classInheritDiv.appendChild(superButton);
            if (l < member["__InheritInfo"].length - 1) {
              const textNode = document.createTextNode("\u00A0>\u00A0");
              classInheritDiv.appendChild(textNode);
              textAreaSDKText += " > ";
            }

            l++;
          }
          textAreaSDKText += "\nnamespace " + targetClassName + " {\n";
          textAreaSDKRows += 2;
          continue;
        }
        if (entryName === "__MDKClassSize") {
          textAreaMDKText +=
            "	static inline constexpr uint64_t __MDKClassSize = " +
            member["__MDKClassSize"] +
            ";\n\npublic:\n";
          textAreaMDKRows += 3;
          continue;
        }

        const overviewItemDiv = document.createElement("div");
        overviewItemDiv.classList.add(
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

        const entryP = document.createElement("button");
        entryP.classList.add("col-span-3", "text-left");
        entryP.textContent = member[Object.keys(member)[0]][0];
        if (member[Object.keys(member)[0]][3] == "C") {
          entryP.classList.add("underline");
          entryP.addEventListener("click", function () {
            getClassInfo(entryP.textContent);
          });
        } else {
          entryP.classList.add("cursor-default");
        }

        overviewItemDiv.appendChild(entryP);

        const nameP = document.createElement("p");
        nameP.classList.add("col-span-3");
        nameP.textContent = entryName;
        overviewItemDiv.appendChild(nameP);

        const offsetP = document.createElement("p");
        offsetP.classList.add("col-span-1", "font-mono");
        offsetP.textContent =
          "0x" + member[Object.keys(member)[0]][1].toString(16);
        overviewItemDiv.appendChild(offsetP);

        const sizeP = document.createElement("p");
        sizeP.classList.add("col-span-1", "pl-8", "font-mono");
        const sizeVal = member[Object.keys(member)[0]][2];
        sizeP.textContent = member[Object.keys(member)[0]][2];
        if (sizeVal < 10) sizeP.textContent += "\u00A0";
        if (sizeVal < 100) sizeP.textContent += "\u00A0";

        overviewItemDiv.appendChild(sizeP);

        itemOverview.appendChild(overviewItemDiv);

        textAreaSDKText += "	constexpr auto ";
        var _entryName = entryName;
        var isBit = false;
        if (
          _entryName.length > 4 &&
          _entryName.charAt(_entryName.length - 3) === ":"
        ) {
          isBit = true;
          _entryName = _entryName.slice(0, -4);
        }
        textAreaSDKText += _entryName + " = ";
        textAreaSDKText +=
          "0x" + member[Object.keys(member)[0]][1].toString(16) + ";";

        textAreaSDKText += " // " + member[Object.keys(member)[0]][0];
        if (isBit) textAreaSDKText += " : 1";
        textAreaSDKText += "\n";
        textAreaSDKRows++;

        _textAreaMDKText =
          "	" +
          member[Object.keys(member)[0]][3] +
          "Member(" +
          member[Object.keys(member)[0]][0] +
          ")";
        while (_textAreaMDKText.length < 54) {
          _textAreaMDKText += " ";
        }
        _textAreaMDKText += _entryName;
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
        if (isBit)
          _textAreaMDKText +=
            "1, " + member[Object.keys(member)[0]][4] + "})\n";
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
      document.getElementById("overview-items-spinner")?.remove();
    }
    //do something with the target class
  }

  document.getElementById("class-spinner")?.remove();
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
