# Roster sample files

These files are for trying the student import on **Students → Import**. The app does not load them by itself. Upload one file at a time.

Pick an intake that does not already use these 提交編號 values. If the page says student intakes are waiting for a database update, the preview can still be read, and nothing is saved.

The spreadsheet columns are **提交編號**, **English Name**, and **Chinese Name**. 提交編號 must be four digits and is stored as text, so `0101` stays `0101`. English Name is required. Chinese Name is optional. Spaces at the start or end of a cell are removed before the preview. A row where all three cells are empty is skipped. ID and 參考編號 are ignored. At most 5,000 student rows are accepted, and the file must be 5 MB or smaller.

Do not open these `.xlsx` files and save them again unless the 提交編號 column format is Text. A normal save can turn `0101` into `101`.

## roster_clean.xlsx

Twenty valid students, rows 2 to 21. Every 提交編號 is text, from `1001` to `1020`.

| 提交編號 | English Name | Chinese Name |
| --- | --- | --- |
| 1001 | Ada Wong | 黃雅達 |
| 1002 | Ben Chan | 陳本恩 |
| 1003 | Chloe Cheung | 張卓怡 |
| 1004 | Daniel Ho | 何丹尼 |
| 1005 | Eva Lam | 林伊娃 |
| 1006 | Felix Leung | 梁輝立 |
| 1007 | Grace Ng | 吳恩雅 |
| 1008 | Henry Au | 區亨利 |
| 1009 | Iris Poon | 潘艾麗 |
| 1010 | Jason Tsang | 曾傑森 |
| 1011 | Karen Yip | 葉嘉倫 |
| 1012 | Leo Mak | 麥利奧 |
| 1013 | Mia Fung | 馮美雅 |
| 1014 | Nathan Siu | 蕭乃森 |
| 1015 | Olivia Tam | 譚奧莉 |
| 1016 | Peter Kwok | 郭彼得 |
| 1017 | Queenie Lai | 賴昆妮 |
| 1018 | Ryan Chow | 周瑞恩 |
| 1019 | Sophie Yeung | 楊蘇菲 |
| 1020 | Thomas Cheng | 鄭湯瑪 |

On a fresh intake the preview says `20 to add, 0 already there, 0 errors`. Import says `20 added, 0 already there, 0 errors`. Importing the same file again says `0 added, 20 already there, 0 errors`.

## roster_extreme.xlsx

One sheet of awkward rows. Codes are shared-string text, including the leading zeros in `0101`, `0010`, and `01234`. Spaces below are really in the cells.

| Row | What is in the cells | What the importer should do |
| --- | --- | --- |
| 2 | `0101`, Eve Lo, 羅伊芙 | Add. The code stays `0101`. |
| 3 | Empty row | Skip. It does not show in the preview. |
| 4 | `  4401  `, `  Pat Ng  `, `  吳柏德  ` | Trim, then add `4401`, Pat Ng, 吳柏德. |
| 5 | Three cells that contain only spaces | Skip. It does not show in the preview. |
| 6 | `0010`, Ian Ku, 古一安 | Add. The code stays `0010`. |
| 7 | `10001`, Five Digit, 伍位數 | Error: Not 4 digits. Do not add. |
| 8 | `01234`, Leading Five, 前零五位 | Error: Not 4 digits. The preview must show `01234`, not `1234`. Do not add. |
| 9 | `AB12`, Letter Code, 字母碼 | Error: Not 4 digits. Do not add. |
| 10 | `WXYZ`, Name Code, 姓名碼 | Error: Not 4 digits. Do not add. |
| 11 | `2222`, First Copy, 第一份 | Error: Duplicate in the file. Do not add either copy. |
| 12 | ` 2222 `, `  Second Copy  `, `  第二份  ` | Same duplicate after trim. Do not add. |
| 13 | `3333` and a 63-character English name, 長名 | Add. Keep the full English name: Alexandria Bartholomew Christopher Montgomery-Wellington Smythe. |
| 14 | `3334`, Rare Script, 彧喆嬡堃 | Add. Keep 彧喆嬡堃. |
| 15 | `3335`, Sam 😊 Lee, 李笑 | Add. Keep the emoji in the English name. |
| 16 | `3336`, spaces only in English Name, 只有中文 | Error: Blank. Do not add. |
| 17 | Spaces only in 提交編號, No Code, 無編號 | Error: Blank. Do not add. |
| 18 | Empty row | Skip. |

On a fresh intake the preview says `6 to add, 0 already there, 8 errors`. The six added codes are `0101`, `4401`, `0010`, `3333`, `3334`, and `3335`. Import says `6 added, 0 already there, 8 errors`.

The importer does not reject a long name, rare characters, or an emoji. The QR card font is a subset, so a later PDF download can stop if a character is missing. That check is separate from import.

## roster_wrong_headers.csv

UTF-8, with a byte-order mark. The columns are `Student Code`, `Pupil Name`, and `中文名`. Two data rows use `0101` and `1002`.

The import should stop before any preview and say: `The file needs a column named 提交編號 and English Name (or Full English name). ID and 參考編號 are ignored. Chinese Name is optional.`

Nothing is saved.
