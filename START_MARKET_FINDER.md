# Market Finder 起動メモ

Codexに頼む時は、次のように言えばOKです。

```text
Market Finderを全部起動して
```

その時に実行するファイルはこれです。

```powershell
.\start-market-finder.ps1
```

ダブルクリックで起動したい時はこれを使います。

```text
start-market-finder.bat
```

起動されるもの:

- Market Finder: `http://127.0.0.1:4173/market-finder/`
- eRank Keyword Tool
- EverBee Product Analytics
- Etsy

アプリだけ開きたい時:

```powershell
.\start-market-finder.ps1 -NoResearch
```

ブラウザは開かず、ローカルサーバーだけ準備したい時:

```powershell
.\start-market-finder.ps1 -NoBrowser
```
