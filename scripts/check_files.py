import sys
import os
import json
import re
import secrets
from github import Github, Auth, InputGitTreeElement
import base64
import hashlib
import gzip
from itertools import islice
import requests


# using an access token
auth = Auth.Token(os.getenv("GITHUB_TOKEN"))
git = Github(auth=auth)

repo = git.get_repo(os.getenv("GITHUB_REPOSITORY"))


_master_branch = "main"

event_path = os.environ['GITHUB_EVENT_PATH']
with open(event_path, 'r') as epfile:
  event_data = json.load(epfile)

pull_request_number = event_data['pull_request']['number']

print("Handling Pull Request Number: " + str(pull_request_number))

#get pr
pr = repo.get_pull(pull_request_number)

# Get the master branch
master_branch = repo.get_branch(_master_branch)

# Get the gameList
gameListC = repo.get_contents("Games/GameList.json", ref=master_branch.commit.sha)
gameList = gameListC.decoded_content.decode('utf-8')

# Get the starboard
starboardC = repo.get_contents("Games/Starboard.json", ref=master_branch.commit.sha)
starboard = starboardC.decoded_content.decode('utf-8')

# Get the updateHistory
gameUpdatesC = repo.get_contents("Recent/GameUpdates.json", ref=master_branch.commit.sha)
gameUpdates = gameUpdatesC.decoded_content.decode('utf-8')

start_sha = pr.head.sha

print(f"Start head SHA: {start_sha}")

# Populated by get_file_arrays(): maps PR file path -> blob SHA. Lets
# get_content_by_name fetch the blob directly instead of doing a separate
# get_contents() call just to look up the SHA.
_pr_file_sha_cache = {}

def get_file_arrays():
  # Classify every file in the PR by its GitHub status. Auto-merge only handles
  # 'added' and 'modified'; everything else ('removed', 'renamed', 'copied',
  # 'changed', 'unchanged') is collected into other_files so main() can bail
  # out with a clear message.
  print(f"looking up pr {pr.number}: {pr.merge_commit_sha}")
  files = list(pr.get_files())
  for file in files:
    print(f"{file.filename} : {file.status}")
    _pr_file_sha_cache[file.filename] = file.sha

  added_files = [f.filename for f in files if f.status == 'added']
  modified_files = [f.filename for f in files if f.status == 'modified']
  other_files = [(f.filename, f.status) for f in files if f.status not in ('added', 'modified')]

  return added_files, modified_files, other_files

def get_content_by_name(filename):
  # Use the SHA cached from pr.get_files() so we skip the separate
  # get_contents() round-trip. Fall back to a contents lookup only if the
  # cache miss is real (shouldn't happen in normal flow).
  sha = _pr_file_sha_cache.get(filename)
  if sha is None:
    sha = repo.get_contents(filename, ref=pr.head.sha).sha
  blob = repo.get_git_blob(sha)
  return base64.b64decode(blob.content).decode("utf8")


def write_to_env(var, value):
  delimiter = "EOF_" + secrets.token_hex(16)

  with open(os.getenv('GITHUB_ENV'), "a") as myfile:
    print(var + "<<" + delimiter, file=myfile)
    print(value, file=myfile)
    print(delimiter, file=myfile)

  print(var + "=" + value)


def env_comment(type, msg):
  write_to_env("ACTION_STATUS", type)
  if type == "success":
    write_to_env("ACTION_MESSAGE", "Good news! Your commit passed all checks and is ready to merge, thanks!\\n" + msg)
  else:
    write_to_env("ACTION_MESSAGE", "Hey there, your pull request could not be merged automatically.\\n\\n" + msg + 
                 "\\n\\nYou can close this commit or wait for manual acceptance if you belive this was unexpected. You can" + 
                 " ignore this and wait if your pull request was NOT for updating or adding games.")
  

def compress_string(data):
  compressed_data = gzip.compress(data.encode())
  # This now returns bytes, which is what we need for the new commit function
  return compressed_data



def is_valid_json(json_str):
  try:
    json.loads(json_str)
    return True
  except json.JSONDecodeError:
    return False


def check_for_malicious_code(json_str):
  # Check for potential links
  links = re.findall(r'https?://\S+', json_str)
  if links:
    print("Potential links found:")
    for link in links:
      if link.startswith('https://github.com/'):
        break
      print(link)
      return True, "Potential links found"
  
  # Check for JavaScript code
  javascript_code = re.findall(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', json_str, re.IGNORECASE)
  if javascript_code:
    print("Potential JavaScript code found:")
    for code in javascript_code:
      print(code)
    return True, "Potential JavaScript code found."
  
  return False, ""


def check_ntfs_compatibility(files):
  forbidden = re.compile(r'[<>:"\\|?*\x00-\x1f]')
  reserved_names = {'CON', 'PRN', 'AUX', 'NUL'} | {f'COM{i}' for i in range(1, 10)} | {f'LPT{i}' for i in range(1, 10)}

  for file_name in files:
    for seg in file_name.split('/')[2:]:
      if not seg:
        continue
      bad = forbidden.search(seg)
      if bad:
        st = "Path " + file_name + " cannot be checked out on Windows. Segment '" + seg + "' contains the reserved character '" + bad.group(0) + "'. Folder and file names must not contain <>:\"\\|?* or control characters."
        print(st)
        return False, st
      if seg.endswith(' ') or seg.endswith('.'):
        st = "Path " + file_name + " cannot be checked out on Windows. Segment '" + seg + "' ends with a space or period."
        print(st)
        return False, st
      stem = seg.split('.', 1)[0].upper()
      if stem in reserved_names:
        st = "Path " + file_name + " cannot be checked out on Windows. Segment '" + seg + "' uses the reserved device name '" + stem + "'."
        print(st)
        return False, st
  return True, ""


def basic_check(files):
  folder1 = 'Games'
  folder2_options = ['Unity', 'Unreal-Engine-3', 'Unreal-Engine-4', 'Unreal-Engine-5']

  if any(file_name.count('/') != 3 for file_name in files):
    st = "A file is not in 3 subfolders. All files have to be in Games/(engine)/(Game)."
    print(st)
    return False, st


  if any(file_name.split('/')[0] != folder1 for file_name in files):
    st = "A file is not in the Games folder. All files have to be in Games/(engine)/(Game)/."
    print(st)
    return False, st

  if any(file_name.split('/')[1] not in folder2_options for file_name in files):
    st = "A file is not in any supported engine (" + ', '.join(folder2_options) + ") folder. New engines are not supported by default."
    print(st)
    return False, st

  ok, msg = check_ntfs_compatibility(files)
  if not ok:
    return False, msg

  return True, ""

# --- NEW FUNCTION TO COMMIT ALL FILES AT ONCE ---
def commit_all_changes_at_once(commit_message, text_files, binary_files):
    """
    Creates a single commit with multiple file changes using the Git Data API.
    :param commit_message: The commit message.
    :param text_files: A dictionary of {path: content_string}.
    :param binary_files: A dictionary of {path: content_bytes}.
    """
    try:
        # Get the reference for the master branch
        ref = repo.get_git_ref(f'heads/{_master_branch}')
        latest_commit = repo.get_git_commit(ref.object.sha)
        base_tree = latest_commit.tree

        tree_elements = []

        # Process text files
        for path, content in text_files.items():
            blob = repo.create_git_blob(content, 'utf-8')
            tree_elements.append(InputGitTreeElement(path, '100644', 'blob', sha=blob.sha))
        
        # Process binary files (like .gz)
        for path, content in binary_files.items():
            # For binary content, we need to base64 encode it
            b64_content = base64.b64encode(content).decode('utf-8')
            blob = repo.create_git_blob(b64_content, 'base64')
            tree_elements.append(InputGitTreeElement(path, '100644', 'blob', sha=blob.sha))

        # Create the new tree
        new_tree = repo.create_git_tree(tree_elements, base_tree)

        # Create the new commit
        new_commit = repo.create_git_commit(
            message=commit_message,
            tree=new_tree,
            parents=[latest_commit]
        )

        # Update the branch reference to point to the new commit
        ref.edit(new_commit.sha)
        print(f"Successfully created a single commit with SHA: {new_commit.sha}")
        return True
    except Exception as e:
        print(f"Failed to create commit: {e}")
        return False


def check_changed_files(changed_files):
  required_files = ['ClassesInfo.json', 'EnumsInfo.json', 'OffsetsInfo.json', 'StructsInfo.json']
  optional_files = ['FunctionsInfo.json']
  all_allowed_files = required_files + optional_files

  if len(changed_files) < len(required_files) or len(changed_files) > len(all_allowed_files):
    st = "The amount of changed files must be 4 or 5 per commit. Required: " + ', '.join(required_files) + ". Optional: " + ', '.join(optional_files) + "."
    print(st)
    return False, st

  gameListData = json.loads(gameList)
  updateListData = json.loads(gameUpdates)
  starboardData = json.loads(starboard)
  game_names = [game["location"] for game in gameListData["games"]]

  if any(all(folder3 not in file_name.split('/')[2] for folder3 in game_names) for file_name in changed_files):
    st = "A file is not in any supported game (" + ', '.join(game_names) + ") folder. This error should not happen?"
    print(st)
    return False, st
  
  for file_name in changed_files:
    if file_name.split('/')[2] != changed_files[0].split('/')[2] or file_name.split('/')[1] != changed_files[0].split('/')[1]:
      st = "The files have to update one game, not multiple games."
      print(st)
      return False, st
  
  files_no_path = [os.path.basename(file) for file in changed_files]

  # All required files must be present, and any extra files must be from the optional list
  if not set(required_files).issubset(set(files_no_path)):
    st = "Missing required files. Required: " + ', '.join(required_files) + "."
    print(st)
    return False, st
  
  if not set(files_no_path).issubset(set(all_allowed_files)):
    st = "Unknown files found. Allowed files: " + ', '.join(all_allowed_files) + "."
    print(st)
    return False, st
  
  updated_at = 0
  for file in changed_files:
    f1 = get_content_by_name(file)
    if not is_valid_json(f1):
      st = "The file" + file + " is not a valid JSON file"
      print(st)
      return False, st
    
    print("checking " + file)
    
    _res, _str = check_for_malicious_code(f1)
    if _res:
      return False, _str
    print("file looks safe.")

    fileData = json.loads(f1) # Load once
    if updated_at == 0:
      updated_at = int(fileData.get('updated_at', 0))
      
    jsonVersion = fileData.get('version', 0)

    lowestVersion = 10201
    latestVersion = 10202
    doesntHaveLatestVersion = False

    if jsonVersion < lowestVersion:
      st = "File version too old. Please use the latest supported Dumper(s). Your Version: " + str(jsonVersion) + " Latest version: " + str(latestVersion)
      return False, st
    
    if jsonVersion != latestVersion:
        doesntHaveLatestVersion = True
  
  
  print("updated timestamp: " +  str(updated_at))

  gHash = 0
  gType = "Updated"
  gUploaded = updated_at
  gUploader = {
        "name": json.dumps(pr.user.login, ensure_ascii=False).replace("\"", ""),
        "link": json.dumps(pr.user.html_url, ensure_ascii=False).replace("\"", "") 
  }

  for game in gameListData['games']:
    if game['location'] == changed_files[0].split('/')[2]:
      game['uploaded'] = updated_at
      gHash = game["hash"]
      game['uploader']['name'] = json.dumps(pr.user.login, ensure_ascii=False).replace("\"", "")
      game['uploader']['link'] = json.dumps(pr.user.html_url, ensure_ascii=False).replace("\"", "")

  new_update = {
    "type": gType,
    "hash": gHash,
    "uploaded": gUploaded,
    "uploader": gUploader
  }

  updateListData["updates"].insert(0, new_update)

  for entry in starboardData:
    if entry['name'] == gUploader['name']:
      entry['count'] += 1
      break
  else:
    starboardData.append(
      {'name': gUploader['name'], 
       'count': 1, 
       'url': gUploader['link'],
       'aurl': json.dumps(pr.user.avatar_url, ensure_ascii=False).replace("\"", "") 
       })

  # --- PREPARE FOR SINGLE COMMIT ---
  text_files_to_commit = {
      "Games/GameList.json": json.dumps(gameListData),
      "Recent/GameUpdates.json": json.dumps(updateListData),
      "Games/Starboard.json": json.dumps(starboardData)
  }

  binary_files_to_commit = {}
  for file in changed_files:
      content = get_content_by_name(file)
      compressed_data = compress_string(content)
      binary_files_to_commit[file + ".gz"] = compressed_data

  commit_message = f"Update game files for {changed_files[0].split('/')[2]}"
  
  if not commit_all_changes_at_once(commit_message, text_files_to_commit, binary_files_to_commit):
      return False, "Failed to create the commit. Please check the logs."

  if doesntHaveLatestVersion:
    return True, "Successfully updated " + changed_files[0].split('/')[2]+ ", however the file(s) you uploaded are from generator version " + str(jsonVersion) + ". Please download the latest dumper to get the latest version (" + str(latestVersion) + "). Your version will be deprecated soon."
  else:
    return True, "Successfully updated " + changed_files[0].split('/')[2]+ "! You can now view it on the website."

# Function to generate a hash from timestamp, location, and engine
def generate_hash(timestamp, location, engine):
    data_to_hash = f"{timestamp}{location}{engine}"
    hash_object = hashlib.md5(data_to_hash.encode())
    return hash_object.hexdigest()[:8]

def check_added_files(added_files):
  folder3_options = ['ClassesInfo.json', 'EnumsInfo.json', 'FunctionsInfo.json', 'OffsetsInfo.json', 'StructsInfo.json', 'image.jpg']

  if len(added_files) != len(folder3_options):
    st = "The amount of added files for a new game must be 6 per commit and must have exactly these names: " + ', '.join(folder3_options) + "."
    print(st)
    return False, st
  
  for file_name in added_files:
    if file_name.split('/')[2] != added_files[0].split('/')[2] or file_name.split('/')[1] != added_files[0].split('/')[1]:
      st = "The files have to add one game, not multiple games."
      print(st)
      return False, st
  
  gameListData = json.loads(gameList)
  updateListData = json.loads(gameUpdates)
  starboardData = json.loads(starboard)

  for game in gameListData["games"]:
    if game["engine"] == added_files[0].split('/')[1] and game["location"] == added_files[0].split('/')[2]:
        st = "The game already exists in the GameList.json (This should not happen?)"
        print(st)
        return False, st
    
  
  files_no_path = [os.path.basename(file) for file in added_files]

  if set(files_no_path) != set(folder3_options):
    st = "The files changed must have exactly these names:" + ', '.join(folder3_options) + "."
    print(st)
    return False, st
  
  updated_at = 0
  for file in added_files:
    if os.path.basename(file) == "image.jpg":
      continue
    f1 = get_content_by_name(file)
    if not is_valid_json(f1):
      st = "The file" + file + " is not a valid JSON file"
      print(st)
      return False, st
    
    print("checking " + file)
    
    _res, _str = check_for_malicious_code(f1)
    if _res:
      return False, _str
    print("file looks safe.")

    fileData = json.loads(f1) # Load once
    if updated_at == 0:
      updated_at = int(fileData.get('updated_at', 0))

    jsonVersion = fileData.get('version', 0)
    
    lowestVersion = 10201
    latestVersion = 10202
    doesntHaveLatestVersion = False

    if jsonVersion < lowestVersion:
      st = "File version too old. Please use the latest supported Dumper(s). Your Version: " + str(jsonVersion) + " Latest version: " + str(latestVersion)
      return False, st
    
    if jsonVersion != latestVersion:
        doesntHaveLatestVersion = True

  game_engine = added_files[0].split('/')[1]
  game_loc = added_files[0].split('/')[2]
  
  new_game = {
    "hash": generate_hash(updated_at, game_loc, game_engine),
    "name": game_loc.replace('-', ' '),
    "engine": game_engine,
    "location": game_loc,
    "uploaded": updated_at,
    "uploader": {
        "name": json.dumps(pr.user.login, ensure_ascii=False).replace("\"", ""),
        "link": json.dumps(pr.user.html_url, ensure_ascii=False).replace("\"", "") 
    }
  }

  new_update = {
    "type": "Added",
    "hash": new_game["hash"],
    "uploaded": new_game["uploaded"],
    "uploader": new_game["uploader"]
  }

  gameListData["games"].append(new_game)
  updateListData["updates"].insert(0, new_update)

  for entry in starboardData:
    if entry['name'] == new_game["uploader"]['name']:
      entry['count'] += 1
      break
  else:
    starboardData.append(
      {'name': new_game["uploader"]['name'], 
       'count': 1, 
       'url': new_game["uploader"]['link'],
       'aurl': json.dumps(pr.user.avatar_url, ensure_ascii=False).replace("\"", "") 
       })

  # --- PREPARE FOR SINGLE COMMIT ---
  text_files_to_commit = {
      "Games/GameList.json": json.dumps(gameListData),
      "Recent/GameUpdates.json": json.dumps(updateListData),
      "Games/Starboard.json": json.dumps(starboardData)
  }

  binary_files_to_commit = {}
  for file in added_files:
      if os.path.basename(file) == "image.jpg":
          continue
      content = get_content_by_name(file)
      compressed_data = compress_string(content)
      binary_files_to_commit[file + ".gz"] = compressed_data

  commit_message = f"Add new game: {game_loc}"
  
  if not commit_all_changes_at_once(commit_message, text_files_to_commit, binary_files_to_commit):
      return False, "Failed to create the commit. Please check the logs."

  if doesntHaveLatestVersion:
    return True, "Successfully added the new game, however the file(s) you uploaded are from generator version " + str(jsonVersion) + ". Please download the latest dumper to get the latest version (" + str(latestVersion) + "). Your version will be deprecated soon."
  else:
    return True, "Successfully added the new game! You can now view it on the website."
  

def main():
  added_files, modified_files, other_files = get_file_arrays()

  print("Added files:", added_files)
  print("Modified files:", modified_files)
  print("Other (disallowed) files:", other_files)

  # Auto-merge is only for game dump uploads. Anything that isn't a plain add
  # or modify (removed, renamed, copied, changed, unchanged) blocks merge.
  if other_files:
    statuses = ', '.join(sorted({status for _, status in other_files}))
    paths = ', '.join(sorted({path for path, _ in other_files}))
    env_comment(
      "failure",
      "This PR contains files with unsupported change types (" + statuses + "): " + paths +
      ". Auto-merge only accepts purely new game folders or purely updated game files."
    )
    return

  if not added_files and not modified_files:
    print("No game files detected; nothing to auto-merge.")
    env_comment("failure", "No game files detected in this PR; nothing to auto-merge.")
    return

  # A PR must be either adding a new game OR updating an existing one, not both.
  if added_files and modified_files:
    env_comment(
      "failure",
      "This PR mixes added and modified files. Auto-merge requires either purely new game files or purely updated game files."
    )
    return

  files_to_check = added_files if added_files else modified_files

  _bRes, _sRes = basic_check(files_to_check)
  if not _bRes:
    env_comment("failure", _sRes)
    return

  if added_files:
    print("--- Running ADD files logic ---")
    bRes, sRes = check_added_files(added_files)
  else:
    print("--- Running CHANGE files logic ---")
    bRes, sRes = check_changed_files(modified_files)

  # Safeguard: if the PR was amended while we were processing it, don't merge.
  pr.update()
  print(f"Current head SHA after processing: {pr.head.sha}")

  if pr.head.sha != start_sha:
    bRes = False
    sRes = "Pull request received changes while processing, merge aborted."

  env_comment("success" if bRes else "failure", sRes)

	
if __name__ == "__main__":
  main()
