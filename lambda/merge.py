# -*- coding: utf-8 -*-
import sys
import os.path
import json
from datetime import datetime
import shutil

OLD_JSON_FOLDER = "_old_apl_template"
JSON_FILE_EXT = ".json"
MERGED_NAME = "apl_template_export_merged"
DATA_JSON_NAME = "data.json"
HOMEPAGE_JSON_NAME = "homepage.json"


merge_target_filename = MERGED_NAME + JSON_FILE_EXT

if os.path.exists(merge_target_filename):
    oldfile = MERGED_NAME + str( datetime.now().timestamp() ) + JSON_FILE_EXT
    oldfile_path = os.path.join(OLD_JSON_FOLDER, oldfile)
    shutil.move(merge_target_filename, oldfile_path)


with open(DATA_JSON_NAME, "r", encoding="utf-8") as datajson:
    dataPart = json.load(datajson)

with open(HOMEPAGE_JSON_NAME, "r", encoding="utf-8") as homepagejson:
    homepagePart = json.load(homepagejson)

merged = {}
merged["datasources"] = dataPart
merged["document"] = homepagePart

with open(merge_target_filename, "w", encoding="utf-8") as merge_target:
    json.dump(merged, merge_target, ensure_ascii=False, indent=4)

