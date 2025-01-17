function openGlobalSearch() {
  document.getElementById("globalSearchDiv").classList.remove("hidden");
  document.getElementById("global-search-input").focus();
}

document
  .getElementById("globalSearchDivCloser")
  .addEventListener("click", function () {
    document.getElementById("globalSearchDiv").classList.add("hidden");
  });

const globalSearchInput = document.getElementById("global-search-input");
const searchSpinner = document.getElementById("search-spinner");
const globalSearchStatus = document.getElementById("global-search-status");
const classCheckbox = document.getElementById("classCheckbox");
const structCheckbox = document.getElementById("structCheckbox");
const functionCheckbox = document.getElementById("functionCheckbox");
const enumCheckbox = document.getElementById("enumCheckbox");
const typeSearchCheckbox = document.getElementById("typeSearchCheckbox");
const includeFunctionParamsCheckbox = document.getElementById(
  "includeFunctionParamsCheckbox"
);
const globalSearchListDiv = document.getElementById("GlobalSearchListDiv");
const globalSearchFoundDiv = document.getElementById("globalSearchFoundDiv");
const globalSearchDiv = document.getElementById("globalSearchDiv");

function toggleFunctionParamsCheckbox() {
  const div = document.getElementById("includeFunctionParamsCheckboxDiv");
  if (!div) return;

  div.classList.toggle("hidden");
}

var classJSON = null;
var structJSON = null;
var functionJSON = null;
var enumJSON = null;

var checkedCurrent = false;

async function downloadJSONs() {
  globalSearchStatus.textContent = "Downloading Content...";
  //first check the current type thatd displayed on the website and get that
  //also only check once per load
  if (!checkedCurrent) {
    if (currentType === "C") {
      console.log("got classes via current type");
      classJSON = currentInfoJson;
    } else if (currentType === "S") {
      console.log("got structs via current type");
      structJSON = currentInfoJson;
    } else if (currentType === "F") {
      console.log("got functions via current type");
      functionJSON = currentInfoJson;
    } else if (currentType === "E") {
      console.log("got enums via current type");
      enumJSON = currentInfoJson;
    }
    checkedCurrent = true;
  }
  //if not indexed get from server
  if (classCheckbox.checked && classJSON === null) {
    console.log("downloading classes");
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "ClassesInfo.json.gz",
      uploadTS
    );
    classJSON = JSON.parse(response);
  }
  if (structCheckbox.checked && structJSON === null) {
    console.log("downloading structs");
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "StructsInfo.json.gz",
      uploadTS
    );
    structJSON = JSON.parse(response);
  }
  if (functionCheckbox.checked && functionJSON === null) {
    console.log("downloading functions");
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "FunctionsInfo.json.gz",
      uploadTS
    );
    functionJSON = JSON.parse(response);
  }
  if (enumCheckbox.checked && enumJSON === null) {
    console.log("downloading enums");
    const response = await decompressAndCheckCacheByURL(
      gameDirectory + "EnumsInfo.json.gz",
      uploadTS
    );
    enumJSON = JSON.parse(response);
  }
  globalSearchStatus.textContent = "Loading...";
}

var searchTerm = "";

async function handleClassesOrStructs(isClass) {
  if ((isClass === true ? classJSON : structJSON) == null) return;
  if (!(isClass === true ? classCheckbox : structCheckbox).checked) return;
  var resultsFound = 0;
  resultsFoundP = document.createElement("p");
  resultsFoundP.classList.add(
    "font-semibold",
    "text-xl",
    "text-slate-900",
    "dark:text-slate-100",
    "pb-4"
  );
  resultsFoundP.textContent =
    (isClass === true ? "Class" : "Struct") + " results found: ...";
  globalSearchFoundDiv.appendChild(resultsFoundP);

  for (const gameClass of (isClass === true ? classJSON : structJSON).data) {
    for (const member of gameClass[Object.keys(gameClass)[0]]) {
      const memberName = Object.keys(member)[0];
      if (memberName === "__InheritInfo") continue;
      if (memberName === "__MDKClassSize") continue;

      const memberType = member[memberName][0][0];

      const searchType = typeSearchCheckbox.checked ? memberType : memberName;

      if (
        searchType.toLowerCase().includes(searchTerm.toLowerCase()) === true
      ) {
        resultsFound++;
        gameClassButton = document.createElement("button");
        gameClassButton.classList.add(
          "text-slate-900",
          "dark:text-slate-100",
          "hover:text-blue-500",
          "dark:hover:text-blue-500",
          "flex",
          "grid",
          "grid-cols-8",
          "w-full"
        );
        gameClassClassDiv = document.createElement("div");
        gameClassClassDiv.classList.add("flex", "sm:col-span-3", "col-span-4");

        gameClassClassNameP = document.createElement("p");
        gameClassClassNameP.classList.add("font-semibold", "truncate");
        gameClassClassNameP.textContent = Object.keys(gameClass)[0];

        gameClassClassDiv.appendChild(gameClassClassNameP);

        gameClassButton.appendChild(gameClassClassDiv);

        gameClassMemberDiv = document.createElement("div");
        gameClassMemberDiv.classList.add("flex", "col-span-4");

        gameClassMemberP = document.createElement("p");
        gameClassMemberP.classList.add("sm:mr-2", "truncate");
        gameClassMemberP.textContent = memberType;
        gameClassMemberNameP = document.createElement("p");
        gameClassMemberNameP.classList.add("truncate");
        gameClassMemberNameP.textContent = memberName;

        if (typeSearchCheckbox.checked) {
          gameClassMemberNameP.classList.add(
            "max-sm:hidden",
            "text-gray-500",
            "dark:text-gray-400"
          );
          gameClassMemberP.classList.add("font-semibold");
        } else {
          gameClassMemberP.classList.add(
            "max-sm:hidden",
            "text-gray-500",
            "dark:text-gray-400"
          );
          gameClassMemberNameP.classList.add("font-semibold");
        }
        gameClassMemberDiv.appendChild(gameClassMemberP);
        gameClassMemberDiv.appendChild(gameClassMemberNameP);

        gameClassButton.appendChild(gameClassMemberDiv);

        memberOffsetP = document.createElement("p");
        memberOffsetP.classList.add(
          "col-span-1",
          "font-mono",
          "text-left",
          "max-sm:hidden"
        );
        memberOffsetP.textContent =
          "0x" + member[Object.keys(member)[0]][1].toString(16);

        gameClassButton.appendChild(memberOffsetP);

        gameClassButton.addEventListener(
          "mouseup",
          function (currentType, memberType, cname, memberName, event) {
            if (event.button === 1) {
              reloadWithNewCName(cname, memberType, memberName, true);
            } else {
              if (currentType != memberType) {
                reloadWithNewCName(cname, memberType, memberName);
              } else displayCurrentType(cname, memberName);
            }
            globalSearchDiv.classList.add("hidden");
          }.bind(
            null,
            currentType,
            isClass === true ? "C" : "S",
            gameClassClassNameP.textContent,
            memberName
          )
        );
        globalSearchFoundDiv.appendChild(gameClassButton);
      }
    }
  }

  resultsFoundP.textContent =
    (isClass === true ? "Class" : "Struct") + " results found: " + resultsFound;

  //add some padding to the struct result p but only if classes are displayed
  if (!isClass && classCheckbox.checked) {
    resultsFoundP.classList.add("pt-10");
  }
}

async function handleFunctions() {
  if (functionJSON == null) return;
  if (!functionCheckbox.checked) return;
  var resultsFound = 0;
  resultsFoundP = document.createElement("p");
  resultsFoundP.classList.add(
    "font-semibold",
    "text-xl",
    "text-slate-900",
    "dark:text-slate-100",
    "pb-4"
  );
  resultsFoundP.textContent = "Function results found: 0";
  globalSearchFoundDiv.appendChild(resultsFoundP);

  for (const func of functionJSON.data) {
    for (const funcItem of func[Object.keys(func)[0]]) {
      const funcName = Object.keys(funcItem)[0];
      const className = Object.keys(func)[0];

      //console.log(funcName);
      console.log(funcItem);

      let resultFound = false;
      if (typeSearchCheckbox.checked) {
        resultFound =
          className.toLowerCase().includes(searchTerm.toLowerCase()) === true;
      } else
        resultFound =
          funcName.toLowerCase().includes(searchTerm.toLowerCase()) === true;

      if (includeFunctionParamsCheckbox && !resultFound) {
        //parameters are in the second array
        for (const param of funcItem[funcName][1]) {
          console.log(param[0][0]);
          let possibleMatch = "";
          //type is the first array and name the first index of the array
          if (typeSearchCheckbox.checked) possibleMatch = param[0][0];
          else possibleMatch = param[2];

          if (possibleMatch.toLowerCase().includes(searchTerm.toLowerCase())) {
            resultFound = true;
            break;
          }
        }
      }

      if (resultFound) {
        resultsFound++;
        funcButton = document.createElement("button");
        funcButton.classList.add(
          "text-slate-900",
          "dark:text-slate-100",
          "hover:text-blue-500",
          "dark:hover:text-blue-500",
          "flex",
          "grid",
          "grid-cols-8",
          "w-full"
        );

        functionClassNameDiv = document.createElement("div");
        functionClassNameDiv.classList.add("flex", "col-span-3");

        functionClassP = document.createElement("p");
        functionClassP.classList.add(
          "text-gray-500",
          "dark:text-gray-400",
          "mr-2",
          "col-span-3"
        );
        functionClassP.textContent = "Class";

        functionClassNameP = document.createElement("p");
        functionClassNameP.classList.add("font-semibold", "truncate");
        functionClassNameP.textContent = className;

        functionClassNameDiv.appendChild(functionClassP);
        functionClassNameDiv.appendChild(functionClassNameP);

        funcButton.appendChild(functionClassNameDiv);

        functionNameDiv = document.createElement("div");
        functionNameDiv.classList.add("flex", "col-span-4");

        functionMemberNameP = document.createElement("p");
        functionMemberNameP.classList.add(
          "text-gray-500",
          "dark:text-gray-400",
          "mr-2"
        );
        functionMemberNameP.textContent = "function";
        functionMemberP = document.createElement("p");
        functionMemberP.classList.add("font-semibold", "truncate");
        functionMemberP.textContent = funcName;

        functionNameDiv.appendChild(functionMemberNameP);
        functionNameDiv.appendChild(functionMemberP);

        funcButton.appendChild(functionNameDiv);

        funcOffsetP = document.createElement("p");
        funcOffsetP.classList.add("col-span-1", "font-mono", "text-left");
        funcOffsetP.textContent = "0x" + funcItem[funcName][2].toString(16);

        funcButton.appendChild(funcOffsetP);

        funcButton.addEventListener(
          "mouseup",
          function (currentType, memberType, cname, funcName, event) {
            if (event.button === 1) {
              reloadWithNewCName(cname, memberType, funcName, true);
            } else {
              if (currentType != memberType) {
                reloadWithNewCName(cname, memberType, funcName);
              } else displayCurrentType(cname, funcName);
            }
          }.bind(null, currentType, "F", className, funcName)
        );
        globalSearchFoundDiv.appendChild(funcButton);
      }
    }
  }
  resultsFoundP.textContent = "Function results found: " + resultsFound;
  if (classCheckbox.checked || structCheckbox.checked) {
    resultsFoundP.classList.add("pt-10");
  }
}

async function handleEnums() {
  if (enumJSON == null) return;
  if (!enumCheckbox.checked) return;
  var resultsFound = 0;
  resultsFoundP = document.createElement("p");
  resultsFoundP.classList.add(
    "font-semibold",
    "text-xl",
    "text-slate-900",
    "dark:text-slate-100",
    "pb-4"
  );
  resultsFoundP.textContent = "Enum results found: 0";
  globalSearchFoundDiv.appendChild(resultsFoundP);

  for (const enu of enumJSON.data) {
    for (const enuItem of enu[Object.keys(enu)[0]][0]) {
      const itemName = Object.keys(enuItem)[0];
      if (itemName.toLowerCase().includes(searchTerm.toLowerCase()) === true) {
        resultsFound++;
        enumButton = document.createElement("button");
        enumButton.classList.add(
          "text-slate-900",
          "dark:text-slate-100",
          "hover:text-blue-500",
          "dark:hover:text-blue-500",
          "flex",
          "grid",
          "grid-cols-8",
          "w-full"
        );

        enumEnumNameDiv = document.createElement("div");
        enumEnumNameDiv.classList.add("flex", "col-span-3");

        EnumEnumP = document.createElement("p");
        EnumEnumP.classList.add(
          "text-gray-500",
          "dark:text-gray-400",
          "mr-2",
          "col-span-3"
        );
        EnumEnumP.textContent = "Enum";

        EnumEnumNameP = document.createElement("p");
        EnumEnumNameP.classList.add("font-semibold", "truncate");
        EnumEnumNameP.textContent = Object.keys(enu)[0];

        enumEnumNameDiv.appendChild(EnumEnumP);
        enumEnumNameDiv.appendChild(EnumEnumNameP);

        enumButton.appendChild(enumEnumNameDiv);

        enumMemberNameDiv = document.createElement("div");
        enumMemberNameDiv.classList.add("flex", "col-span-5");

        enumMemberMemberP = document.createElement("p");
        enumMemberMemberP.classList.add(
          "text-gray-500",
          "dark:text-gray-400",
          "mr-2"
        );
        enumMemberMemberP.textContent = "member";
        enumMemberNameP = document.createElement("p");
        enumMemberNameP.classList.add("font-semibold", "truncate");
        enumMemberNameP.textContent = itemName;

        enumMemberNameDiv.appendChild(enumMemberMemberP);
        enumMemberNameDiv.appendChild(enumMemberNameP);

        enumButton.appendChild(enumMemberNameDiv);

        enumButton.addEventListener(
          "mouseup",
          function (currentType, memberType, cname, event) {
            if (event.button === 1) {
              reloadWithNewCName(cname, memberType, null, true);
            } else {
              if (currentType != memberType) {
                reloadWithNewCName(cname, memberType);
              } else displayCurrentType(cname);
            }
          }.bind(null, currentType, "E", EnumEnumNameP.textContent)
        );
        globalSearchFoundDiv.appendChild(enumButton);
      }
    }
  }
  resultsFoundP.textContent = "Enum results found: " + resultsFound;
  if (
    classCheckbox.checked ||
    structCheckbox.checked ||
    functionCheckbox.checked
  ) {
    resultsFoundP.classList.add("pt-10");
  }
}

async function handleGlobalSearch() {
  searchSpinner.classList.remove("hidden");
  console.log("Input string:", searchTerm);
  globalSearchFoundDiv.classList.add("hidden");
  while (globalSearchFoundDiv.firstChild) {
    globalSearchFoundDiv.removeChild(globalSearchFoundDiv.firstChild);
  }

  globalSearchStatus.textContent = "Loading...";
  await downloadJSONs();

  await handleClassesOrStructs(true);
  await handleClassesOrStructs(false);
  await handleFunctions();
  await handleEnums();
  searchSpinner.classList.add("hidden");
  globalSearchFoundDiv.classList.remove("hidden");
}

function handleGlobalSearchInput(event) {
  if (event.keyCode == 13) {
    var value = globalSearchInput.value;
    globalSearchInput.blur();
    searchTerm = value;
    if (value.length !== 0) handleGlobalSearch();
  }
}
