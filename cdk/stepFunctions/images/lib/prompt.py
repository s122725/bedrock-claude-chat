# -*- coding: utf-8 -*-
promptTest = (
"""
\n\nHuman: はじめに、あなたに与えるデータについて解説します。注意深くデータを観察してください。
<ルール>を絶対に守ってください。<ルール>に違反することは禁止です。

<OCR結果> にパワーポイントの全ページをOCRしたテキストが含まれています。これを参考にしながら画像の文字起こしをしてください。

<ルール>
- <ステップ> は必ずすべて実行してください。
- 回答生成前に考えていることは <thinking> に出力してください。
- 出力はマークダウン形式です。
- 写真や構成図などが与えられた画像に含まれている場合は、内容を説明して[[]]で囲って詳細な説明文をテキストとして出力してください。オブジェクトや図形の説明などは不要です。与えられた画像はスクリーンショットは画像ですが、スクリーンショット自体の説明は不要です。
- フロー図、フローチャート、プロセスの流れが与えられた画像に含まれている場合は、条件分岐を正確に記載してください。<フロー図、フローチャート、プロセスの流れの記述例>のフォーマットを参考にしてください。
- 与えられた画像のページに該当するものだけを出力してください。他のページのことを出力するのは禁止です。
- チェックリストが与えられた画像に含まれている場合は、マークダウンのチェックボックス表記で記載してください。
- 表形式がが与えられた画像に含まれている場合は、マークダウンの表形式で記載してください。
- グラフの値は文字起こしの対象に含めないでください。
</ルール>

<OCR結果>
{}
</OCR結果>

<フロー図、フローチャート、プロセスの流れの記述例>
┠ 現在のまま住み続けたい
┃ ┗ 健康な体・暮らしの追求
┗ 住み替えを検討したい
  ┠ 将来の介護に備えたシニア施設への入居
  ┗ 住まいと暮らしのダウンサイジング
</フロー図、フローチャート、プロセスの流れの記述例>

<output> に出力例が与えられます。

<output>
  <thinking>
  </thinking>

  <result>
  </result>
</output>

<処理ステップ>に従って処理を実行してください。

<処理ステップ>
ステップ1. <OCR結果>より、画像のページに含まれているテキストを出力します。
ステップ2. 与えられた画像はパワーポイントファイルの1ページを抜粋したスクリーンショットです。文字起こしして、markdown形式で出力してください。人間が認識するような順番・親子関係としてheadingしてください。
ステップ3. ステップ1を参考にしてステップ2の文字起こしの結果を公正した後の文字起こし結果を出力してください。
</処理ステップ>

Think step by step
"""
)