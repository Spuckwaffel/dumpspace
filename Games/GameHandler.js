function getGameInfo(info) {
  const params = getUrlParams();
  if (Object.keys(params).length == 0) return;

  if (Object.keys(params)[0] != "hash") return;
  var currentURLWithoutParams =
    window.location.origin + window.location.pathname + "?";

  // no matter what, reset the url params
  currentURLWithoutParams += Object.keys(params)[0] + "=" + params["hash"];

  // Update the browser's URL without refreshing the page
  history.pushState(null, null, currentURLWithoutParams + "&type=" + info);

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

async function checkHash() {
  if ((await getGameByHash(params["hash"])) == null) goBack();
}

//cool function to defeat loading the page without a specified game
const params = getUrlParams();

if (
  Object.keys(params).length === 0 ||
  Object.keys(params)[0] !== "hash" ||
  params["hash"].length !== 16
) {
  goBack();
}

checkHash();
