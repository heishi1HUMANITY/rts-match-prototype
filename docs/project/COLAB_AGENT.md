# Colabで実装エージェントを動かす

[Notebook](../../notebooks/RTS_Qwen_Colab.ipynb)は単体で使える。Colabでアップロードするか、GitHubのNotebook URLをColabの「GitHub」から開く。GPUランタイムを選び、上から実行する。Qwen3.8-27BのUnsloth UD-Q4_K_M、テキスト入力、16K contextを使用する。40GB以上のGPUを推奨し、22GB未満では標準設定を開始しない。24GB級での可否・速度は実測が必要。

実装・技術レビュー・修正は[Qwen用の恒久指示](QWEN_AGENT_WORKFLOW.md)に従いQwenで行う。GPT6luna/Codexを途中の必須担当にしない。利用者が担当するのはIssue番号の指定と、最後の画面・ふるまいの検査。

## 操作

1. Colab左側のSecretsに`GH_TOKEN`を登録し、Notebookからのアクセスを許可する。対象リポジトリの読取、PRを提出する場合は対象リポジトリのcontents/PR書込が必要。tokenをセルへ直接書かない。
2. セル1でIssue番号とDriveフォルダを指定。初回はDrive接続、ツール準備、モデル取得、CUDAビルドを実行する。モデルファイルは約16.5GBで、Driveと一時ディスクの両方に空き容量が必要。
3. API・ツール呼び出しの確認が通ったら、`RUN_AGENT=True`でセル10を実行。実装後、別会話の読み取り専用Qwenレビューを実行し、指摘があれば`MAX_REPAIRS`回まで修正・再検証・再レビューを行う。標準は2回。`MAX_MINUTES`は各実装/レビュー担当の上限で、全体の所要時間には修正回数とテスト時間も加わる。保存済みブランチや一意の既存PRは自動で継続し、候補が複数あるときだけブランチを指定する。完了済みIssueは再実装しない。
4. `PUBLISH_PR=True`で専用ブランチをpushしdraft PRを作成/更新する。提出には対象差分に対応したレビュー結果と必須チェック2件の成功が必要。PR説明はエージェントの引き継ぎから生成され、任意で上書きできる。
5. PR提出後にセル12を再実行し、commit済みのcleanな検査版を起動する。操作案内に沿ってふるまいを確認する。画面はColab内で動き、Windows側のlocalhostとは別。自動チェックは実ブラウザ操作や横持ち・タッチの検査の代わりにはならない。技術レビューを利用者が代行する必要はない。
6. 修正が必要ならセル1の`USER_FEEDBACK`へ「部隊を選んでも動かない」のような普通の言葉を入力し、セル10から再実行する。同じIssue/PRを修正し、新しい検査版を用意する。
7. 画面の動作確認で合格した場合だけ、任意のセル14で`USER_ACCEPTED=True`を指定して実行する。NotebookがcleanなプレビューSHA、提出SHA、現在のPR head、Windows/Linux CIの成功を照合してマージし、その後Issueを閉じる。CI待ちや版の不一致があればマージしない。実装開始やPR提出は合格の代わりにならない。
8. 終了セルで作業を保存してプロセスを停止し、ランタイムを切断する。

## セッション間の再利用

| 対象         | 保存先・再利用方法                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| モデル       | Driveの`models`。初回のHub revisionとファイルSHA256を固定し、同じ設定なら再取得しない。実行時は一時ディスクへコピー・検証してからGPUへ読む |
| llama-server | Driveの`llama`。commit、GPU compute capability、CUDA、OS、コンパイラで識別。一致するビルドを復元、不一致なら再ビルド                       |
| Node         | Driveの`node`。初回のNode24アーカイブを公式SHA256付きで固定し、一時ディスクへ展開                                                          |
| npm          | Driveの`npm-cache`。Qwen Code 0.25.1と依存の取得キャッシュ。実行環境のインストールはセッションごとに行う                                   |
| 実装途中     | Driveの`work/issue-N`。git bundle、HEADからのbinary patch、未追跡・非ignoreファイルを120秒ごとと終了時に保存。新セッションで復元           |
| ログ         | DriveのIssue別JSONL。token/API keyを置換して保存。Qwenの会話履歴そのものは復元せず、コードと引き継ぎから再開                               |

GPUの割当とColab寿命は保証されない。強制終了直前の変更や、保存失敗中の差分は保持できない。古い保存世代は自動削除せず、不要になったものを手動整理する。`.env`やnode_modulesなどGitのignore対象は作業バックアップへ含めない。

モデル更新時は`MODEL_REVISION`へ新しいSHAを指定する。破損が疑われる場合は`REPAIR_MODEL=True`。llama.cpp更新は`LLAMA_REF`へ別tag/refを指定する。同じref名を使い続ける場合は初回に固定したcommitを再利用する。

## エージェントと権限

Qwen CodeはAGENTS.md、Issue実装ガイドの共通契約と対象節、Qwen用の恒久指示を読む。Notebookが最新Issue本文・コメント・関連PRを取得し、ローカル資料として渡す。セル10の再実行時はIssueとPRを再取得し、GitHub Actionsの失敗ログもQwenへ渡す。モデルAPIは127.0.0.1＋ランダムキーで保護し、外部公開やトンネルを作らない。エージェント子プロセスへGitHub tokenを渡さず、実装者には編集と列挙したテスト・読取コマンド、レビュー役には読取だけを許可する。これはOSサンドボックスではない。未許可コマンドはログ/引き継ぎへ記録し、必要なものだけ許可設定へ追加する。

実装とレビューは同じローカルモデルへ順番に推論させる。レビュー役は別プロセス・別会話で起動するが、別モデルによる独立評価ではない。レビューJSON、対象差分のfingerprint、チェック結果がそろわなければ通常の提出を止める。blocking指摘が残るときは未完了とし、利用者へ検査可能な版として渡さない。ネイティブのサブエージェント定義だけに必須レビューを依存させない。

モデルだけでスクリーンショット操作まで自動化されるわけではない。初版のテキストモデル構成には画像用projector・ブラウザ自動操作を含まない。CI・画面確認は[共通フロー](ISSUE_AGENT_RUNBOOK.md)に従い、未検査範囲を残す。エージェントの終了コード0だけで完了にしない。

修正は`USER_FEEDBACK`へ対象版と普通の言葉による症状・期待動作を渡せばよい。エージェントが再現条件を整理し、同じIssue/ブランチで修正して検証とレビューをやり直す。復元後も過去のレビューを無条件で流用しない。マージの前には最後に提示した検査版への明示合格と完全SHAの一致を確認する。提出セルではマージせず、ユーザーが明示的に合格を指定する任意セルだけがマージを実行する。途中からCodexへ依頼し直す必要はない。

## 保守と検証

編集元は`tools/colab/runtime.py`と`tools/colab/build_notebook.py`。`python tools/colab/build_notebook.py`で自己完結Notebookを再生成する。`python -m unittest discover -s tools/colab -p 'test_*.py'`で、セル構文、モデル再利用、破損コピー、分割GGUF、バックアップ復元、パストラバーサル拒否を検証する。CIでも生成一致とテストを確認する。

Qwen Code 0.25.1の実CLI＋ローカルの模擬モデルAPIで、AGENTS.md読込、ファイル編集、許可したテストの実行、未許可コマンドの拒否を確認した。headless実行の許可設定はcanonical名 `run_shell_command(...)` を使う。模擬APIの確認は実モデルの品質評価ではない。

Colab実機でのGPU起動・実装品質・プレビュー操作はローカル検証では保証できない。最初の利用時にNotebookのAPI/ツール確認と小さい作業で評価する。

参照: [モデル配布](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF)、[Qwen Code](https://github.com/QwenLM/qwen-code)、[llama.cppのビルド](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)、[Colab FAQ](https://research.google.com/colaboratory/faq.html)。
