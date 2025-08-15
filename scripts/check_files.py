import sys
import os
import json
import re
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

def get_file_arrays():

  # Get the diff of the pull request compared to the 'main' branch

  print(f"looking up pr {pr.number}: {pr.merge_commit_sha}")
  #  Get the file changes between the pull request branch and the main branch
  files = pr.get_files()
  for file in files:
    print(f"{file.filename} : {file.status}")

  file_names = [file.filename for file in files]
  added_files = [file.filename for file in files if file.status == 'added']
  deleted_files = [file.filename for file in files if file.status == 'deleted']

  return file_names, added_files, deleted_files

def get_content_by_name(filename):
  blob = repo.get_git_blob(repo.get_contents(filename, ref=pr.head.sha).sha)
  b64 = base64.b64decode(blob.content)
  return b64.decode("utf8")


def write_to_env(var, value):
  with open(os.getenv('GITHUB_ENV'), "a") as myfile:
    print(var + "=" + value, file=myfile)
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


def basic_check(files):
  folder1 = 'Games'
  folder2_options = ['Unity', 'Unreal-Engine-3', 'Unreal-Engine-4', 'Unreal-Engine-5']

  if any(file_name.count('/') != 3 for file_name in files):
    st = "A file is not in 3 subfolders. All files have to be in Games/(engine)/(Game)."
    print(st)
    return False, st
  
  
  if any(folder1 not in file_name.split('/')[0] for file_name in files):
    st = "A file is not in the Games folder. All files have to be in Games/(engine)/(Game)/."
    print(st)
    return False, st
  
  if any(all(folder2 not in file_name.split('/')[1] for folder2 in folder2_options) for file_name in files):
    st = "A file is not in any supported engine (" + ', '.join(folder2_options) + ") folder. New engines are not supported by default."
    print(st)
    return False, st
  
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
  folder3_options = ['ClassesInfo.json', 'EnumsInfo.json', 'FunctionsInfo.json', 'OffsetsInfo.json', 'StructsInfo.json']

  if len(changed_files) != len(folder3_options):
    st = "The amount of changed files must be 5 per commit and must have exactly these names: " + ', '.join(folder3_options) + "."
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

  if set(files_no_path) != set(folder3_options):
    st = "The files changed must have exactly these names:" + ', '.join(folder3_options) + "."
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
  changed_files, added_files, deleted_files = get_file_arrays()

  print("Changed files:", changed_files)
  print("Added files:", added_files)
  print("Deleted files:", deleted_files)

  # Note: The logic here assumes that changed_files is a superset of added_files,
  # which is how the GitHub API presents files in a PR. `added_files` is just a filter.
  # If a file is added, it's in both lists. If modified, it's only in `changed_files`.
  # The original logic of checking `changed_files` and `added_files` separately is fine.
  
  files_to_check = changed_files if changed_files else added_files

  if not files_to_check:
      print("No files to process.")
      return

  if added_files and (set(changed_files) != set(added_files)):
      print("Mixing added and modified files in this way is not supported.")
      env_comment("failure", "Mixed added and modified files are not allowed.")
      return
    
	
  if deleted_files:
    print("Deleted files cannot be processed automatically.")
    env_comment("failure", "Deleted files cannot be processed automatically.")
    return

  _bRes, _sRes = basic_check(files_to_check)
  if not _bRes:
    env_comment("failure", _sRes)
    return
  
  # Determine if we are adding a new game or updating an existing one
  if all(file in added_files for file in files_to_check):
    print("--- Running ADD files logic ---")
    bRes, sRes = check_added_files(added_files)
  else:
    print("--- Running CHANGE files logic ---")
    bRes, sRes = check_changed_files(changed_files)


  # This check for changes during commit might be less reliable now since
  # the single commit happens faster, but it's still a good safeguard.
  pr.update() # Refresh PR data
  print(f"Current head SHA after processing: {pr.head.sha}")

  if pr.head.sha != start_sha:
    bRes = False
    sRes = "Pull request received changes while processing, merge aborted."

  env_comment("success" if bRes else "failure", sRes)

	
if __name__ == "__main__":
  main()
