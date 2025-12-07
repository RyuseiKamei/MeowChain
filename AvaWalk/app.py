
import json
# 送金元 = 0x1e8182b4f053cdde32031a04856280dbdc61d9bf

# 初期値 (文字列として定義)
sk = "b7fc869c184e99253da01ada00150334dac13bc9143b4265a2b5ae327a8cdda8"

# HTTPヘッダーを設定 (Content-Type)
print("Content-Type: application/json; charset=utf-8\n")

# JSON形式でデータを返す
print(json.dumps({"result": sk}))
