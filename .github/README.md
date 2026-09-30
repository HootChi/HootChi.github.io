# Atto Studio 사이트 규칙 · Site rules

이 저장소(HootChi/HootChi.github.io, `main` 브랜치)는 https://hootchi.github.io/ 이고, 모든 Atto Studio 앱이 함께 씁니다.
앱 세션(사람이든 에이전트든)과 앱의 게시 도구는 아래 규칙을 반드시 지켜야 합니다. 목표는 하나입니다: **새 앱이 추가되거나 한 앱이 바뀌어도 다른 앱에는 아무 영향이 없어야 합니다.**

This repo (HootChi/HootChi.github.io, branch `main`) is https://hootchi.github.io/, shared by every Atto Studio app. English version below.

---

## 한국어

### 1. 앱은 최상위 폴더 하나만 가집니다

- 앱마다 최상위 폴더가 정확히 하나입니다. 예: `tuckaway/` → https://hootchi.github.io/tuckaway/
- 폴더 이름: 영문 소문자·숫자·`-`만, 첫 글자는 소문자나 숫자 (`^[a-z0-9][a-z0-9-]*$`), 100자 이하. 예: `tuckaway`, `pangka`, `word-hop`. Windows 장치 이름(`con`, `aux`, `nul`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`)은 안 됩니다 (5번). 앱 게시 도구는 이 규칙에 맞지 않는 폴더 이름으로는 게시하지 않습니다.
- `src`는 쓰지 마세요. 앱 게시 도구는 루트에 `src/`나 `package.json`이 있으면 코드 저장소로 보고 게시를 거부합니다.
- 폴더 이름은 한 번 정하면 바꾸지 않습니다. 스토어에 등록한 개인정보 처리방침·지원 URL이 깨집니다.
- 앱의 게시 도구와 세션은 **자기 폴더 안에서만** 파일을 쓰고 지웁니다. 루트 파일, `.github/`, 다른 앱의 폴더는 절대 건드리지 않습니다.
- 폴더 안의 모든 경로는 5번의 "이식 가능한 경로" 규칙을 지킵니다.

### 2. 스튜디오 파일 (앱이 건드리지 않음)

`.github/`(이 README, `workflows/pages.yml`, `build.mjs`, `test-build.mjs`)와 루트 파일은 스튜디오 파일입니다. 이 저장소에서 스튜디오 작업으로 일부러 고칠 때만 바뀝니다.

- 루트에 둘 수 있는 파일은 이것뿐입니다: `404.html`, `.nojekyll`, `app-ads.txt`, `CNAME`, `.gitignore`, `.gitattributes`. 다른 루트 파일은 그대로 배포되지만 빌드가 경고합니다. 앱 파일은 앱 폴더에 둡니다. 앱에 `app-ads.txt` 줄이 필요하면 스튜디오 편집으로 추가합니다.
- 루트에 `index.html`을 두지 마세요. 첫 페이지는 배포할 때 앱 카드로 **생성**됩니다. 커밋된 루트 `index.html`은 무시되고(대소문자 무관) 경고가 납니다.
- 루트에 `package.json`을 두지 마세요 (위 1번 참고).
- `_site/`는 절대 커밋하지 마세요 (`.gitignore`에 있습니다).

### 3. 앱 카드: `<앱 폴더>/card.json`

첫 페이지의 앱 카드는 각 앱 폴더의 `card.json`(UTF-8 JSON 객체, **64 KiB = 65,536바이트 이하**)으로 만듭니다. `card.json`이 없는 폴더는 카드가 없을 뿐, 파일은 그대로 배포됩니다. 64 KiB보다 큰 `card.json`은 스튜디오 빌드가 읽지 않고 그 카드만 빼며(경고), 앱 게시 도구는 게시를 거부합니다.

| 필드 | 필수 | 내용 |
|---|---|---|
| `name` | 필수 | 앱 이름, 1–80자, 공백이 아닌 글자가 하나 이상. 공백 없이 30자 넘게 이어지면 경고만 납니다 (휴대폰에서 줄바꿈이 안 될 수 있음). |
| `name_ko` | 선택 | 한국어 이름, 80자 이하 |
| `summary` | 필수 | 한 줄 소개, 1–200자, 공백이 아닌 글자가 하나 이상 |
| `summary_ko` | 선택 | 한국어 소개, 200자 이하 |
| `since` | 필수 | 그 폴더가 사이트에 처음 올라간 날짜 `"YYYY-MM-DD"` (실제 있는 날짜, UTC). 아래 "`since` 규칙" 참고. 나중에 바꾸지 마세요. |
| `links` | 선택 | 10개 이하의 `{ "label", "label_ko"(선택), "href" }` 배열. `label` 1–60자, `label_ko` 60자 이하 |
| `contact` | 선택 | 문의 이메일 (`mailto:` 링크가 됨) |

- **텍스트 필드**(`name`, `name_ko`, `summary`, `summary_ko`, `label`, `label_ko`)에는
  - 제어 문자나 서식 문자(유니코드 `\p{Cc}`, `\p{Cf}`)를 쓸 수 없습니다. 예: 탭, 줄바꿈, 폭 없는 공백 U+200B, ZWJ U+200D, 방향 제어 문자 U+202E, 소프트 하이픈 U+00AD, BOM U+FEFF.
  - 짝이 없는 서로게이트(`\p{Cs}`, JSON에서 `"\ud800"`처럼 쓴 것)를 쓸 수 없습니다. 이모지처럼 짝이 맞는 서로게이트 쌍은 괜찮습니다.
  - 결합 문자(`\p{M}`)가 3개 이상 연달아 올 수 없습니다.
  - 필수 필드(`name`, `summary`)가 규칙을 어기면 카드가 빠지고, 링크의 `label`이 어기면 그 링크가 빠지고, 선택 필드가 어기면 그 필드만 빠집니다.
- 카드 순서는 `since` 오름차순, 같으면 폴더 이름 순입니다. 그래서 새 앱은 항상 맨 뒤에 붙고, 기존 카드의 순서나 내용은 바뀌지 않습니다.
- 모든 값은 일반 텍스트입니다. HTML은 그대로 이스케이프되어 글자로 보입니다.
- 모르는 키는 무시됩니다.
- `href`는 둘 중 하나입니다.
  - 앱 폴더 안의 상대 경로: `privacy/`, `terms/`, `faq.html`, `support/#contact`. `/`로 시작하면 안 되고, `..`, `\`, `//`, `http:`·`javascript:` 같은 스킴, 공백·제어 문자(공백은 `%20`), `%2e`·`%2f`·`%5c`, 점(`.`)으로 시작하는 폴더·파일은 쓸 수 없습니다. 가리키는 파일이 그 앱 폴더에 실제로 있어야 합니다 (`x/`는 `x/index.html`을 확인). 폴더는 반드시 `/`로 끝내세요 (`privacy`가 아니라 `privacy/`).
  - `https://`로 시작하는 절대 URL (그대로 사용).

**`since` 규칙.** `since`는 그 폴더가 사이트에 처음 올라간 날짜(UTC)입니다. 새 카드의 `since`는 이미 있는 모든 카드의 `since`와 같거나 그 뒤여야 하고(그래서 새 카드는 맨 뒤에 붙습니다), 미래 날짜면 안 됩니다. 앱 게시 도구는 미래 날짜를 거부합니다. 스튜디오 빌드는 `since`가 빌드 날짜(UTC)보다 뒤면 경고만 하고 카드는 그대로 보여 줍니다.

tuckaway의 예:

```json
{
  "name": "Tuckaway: Critter Logic",
  "name_ko": "쉿! 숲속 하숙집",
  "summary": "A logic puzzle game for iPhone, iPad and Android.",
  "summary_ko": "iPhone·iPad·Android용 논리 퍼즐 게임입니다.",
  "since": "2026-09-29",
  "links": [
    { "label": "Privacy Policy", "label_ko": "개인정보 처리방침", "href": "privacy/" },
    { "label": "Terms of Use", "label_ko": "이용약관", "href": "terms/" },
    { "label": "Support", "label_ko": "고객 지원", "href": "support/" }
  ],
  "contact": "attostudio.support@gmail.com"
}
```

**카드에 문제가 있어도 빌드는 실패하지 않습니다.** JSON이 깨졌거나 필수 필드가 틀리면 그 앱의 카드만 빠지고, 링크 하나가 틀리면 그 링크만 빠지고, 선택 필드가 틀리면 그 필드만 빠집니다. 각각 Actions 실행에 경고(annotation)로 남고, 실행 요약(run summary)에도 모두 나옵니다. 다른 앱의 카드와 모든 앱의 페이지는 그대로 배포됩니다.

### 4. 크기 예산

사이트 전체(모든 앱 폴더와 루트 파일, 생성된 `index.html` 포함)는 **800 MB** 이하로 유지합니다. GitHub Pages 사이트는 1 GB로 제한됩니다. 800 MB를 넘으면 빌드가 경고하고, 실행 요약에 최상위 폴더별 크기가 나옵니다. 큰 동영상이나 빌드 결과물은 올리지 마세요.

### 5. 이식 가능한 경로

앱 폴더 안의 모든 경로(앱 폴더 이름 포함)는 다음을 지킵니다.

- 경로의 각 부분(폴더·파일 이름)은 `A-Z a-z 0-9 . _ -` 글자만 씁니다. 공백, 한글, `:` `\` 같은 글자는 안 됩니다.
- 각 부분은 `.`으로 시작하거나 `.`으로 끝나지 않습니다 (`.well-known`, `draft.` 안 됨).
- 각 부분은 100바이트 이하입니다.
- 저장소 루트부터 센 전체 경로(예: `tuckaway/privacy/index.html`, 앱 폴더 이름 포함)는 200바이트(UTF-8) 이하입니다.
- Windows 장치 이름이 아닙니다: `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`. 대소문자와 확장자에 상관없습니다 (`con`, `Aux.html`, `nul.txt` 모두 안 됨).
- 대소문자만 다른 두 경로가 없습니다 (`Page.html`과 `page.html`, `img/`와 `IMG/`). 경고에는 두 경로가 모두 나옵니다.

**이유:** 앱 게시 도구는 이 저장소 **전체**를 clone하고, Windows에서도 돌아갑니다. 한 앱이 Windows가 만들 수 없는 경로를 커밋하면, 그 앱과 상관없는 **다른 모든 앱**의 Windows 게시 도구에서 clone/checkout이 깨집니다.

- 앱 게시 도구는 자기 폴더에 위반 경로가 하나라도 있으면 게시를 거부합니다 (`##[`가 들어간 경로, 200바이트가 넘는 경로 포함).
- 스튜디오 빌드는 위반 경로마다 경고하고, 복사할 수 있으면 그대로 배포합니다 (잘못된 이름의 폴더는 그 폴더 한 번만 경고).
- 다만 저장소 **어디서든**(루트 포함) 이름에 `##[`가 들어간 파일·폴더, 그리고 경로가 200바이트를 넘는 파일·폴더는 스튜디오 빌드가 경고 후 **배포하지 않습니다** (폴더면 그 안의 모든 것). 업로드 단계의 `tar -v`는 모든 경로를 로그에 찍는데, Actions 러너는 로그 줄 어디에서든 `##[`를 명령으로 읽어 그 단계를 실패시킬 수 있습니다. 200바이트 제한은 폴더 깊이도 제한합니다.
- UTF-8이 아닌 이름의 파일·폴더는 경고 후 배포되지 않습니다. 복사할 수 없는 파일도 경고 후 그 파일만 빠집니다.

### 6. 배포 방식

- GitHub Pages의 Source는 **GitHub Actions**입니다 (스튜디오 설정). Jekyll은 실행되지 않습니다.
- `main`에 push하면(또는 Actions에서 수동 실행하면) `.github/workflows/pages.yml`이 돕니다.
  1. `node .github/test-build.mjs` — 빌드 스크립트 자체 테스트 (가상의 임시 저장소만 사용하므로 앱 내용 때문에 실패하지 않음)
  2. `node .github/build.mjs "$RUNNER_TEMP/site"` — 저장소 **밖**의 러너 임시 폴더에, 저장소의 모든 파일을 바이트 그대로 복사(`.git/`, `.github/`, 루트 `index.html` 제외)하고 앱 카드로 `index.html`을 생성
  3. 그 폴더를 업로드하고 배포 (배포는 `main`에서만. 다른 브랜치에서 수동 실행하면 테스트와 빌드만 함)
- 워크플로 권한: 기본은 읽기(`contents: read`)뿐이고, 배포 작업만 `pages: write`와 `id-token: write`를 가집니다. 각 작업은 10분 안에 끝나야 합니다. Node 24(테스트한 버전)를 쓰고, 패키지 관리자가 없으므로 의존성 캐시도 쓰지 않습니다.
- 한 브랜치에서는 한 번에 한 실행만 돕니다. 다음 실행은 앞 실행을 취소하지 않고 기다립니다. 다른 브랜치의 수동 실행은 `main`의 배포를 막지 않습니다.
- **실행 요약(run summary):** 각 실행의 요약 페이지에 보여 준 카드, 빠진 카드와 이유, **모든 경고**, 전체 크기와 최상위 폴더별 크기가 나옵니다. 경고는 annotation으로도 남습니다. 빌드가 찍는 모든 줄에서 `##[`는 `#%23[`(경고와 실행 요약) 또는 `# #[`(일반 로그 줄)로 바뀝니다.
- 배포되지 않는 것: 점(`.`)으로 시작하는 파일·폴더(업로드 단계에서 빠짐), 심볼릭 링크(경고 후 건너뜀), UTF-8이 아닌 이름(경고 후 건너뜀), 이름에 `##[`가 들어간 경로와 200바이트가 넘는 경로(경고 후 건너뜀, 5번).
- 첫 페이지의 설명(meta description), 스타일, 머리말, 꼬리말(`© 빌드한 해 Atto Studio`)은 `build.mjs`에 있는 스튜디오 파일입니다.
- 로컬 미리보기: `node .github/build.mjs <저장소 밖의 빈 폴더>` (출력 폴더는 비어 있거나 없어야 함). 저장소 안에 `_site/`를 만들었다면 절대 커밋하지 마세요.

### 7. 한 번만: GitHub Actions 배포로 전환

이 방식으로 처음 바꿀 때 스튜디오가 한 번만 합니다. 순서를 지키세요 (push 전에 Source를 바꾸지 않으면 브랜치 배포가 `index.html` 없는 저장소를 그대로 배포합니다).

1. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 바꿉니다.
2. 이 변경을 `main`에 push합니다.
3. Actions 탭에서 그 push의 "Deploy Pages" 실행이 성공했는지(build, deploy 두 작업 모두), 실행 요약에 경고가 없는지 확인합니다.
4. https://hootchi.github.io/ , https://hootchi.github.io/tuckaway/privacy/ , https://hootchi.github.io/tuckaway/terms/ , https://hootchi.github.io/tuckaway/support/ 와 없는 주소(404 페이지)를 열어 확인합니다.
5. 그 push에 대해 "pages-build-deployment" 실행이 **없는지** 확인합니다. 있다면 Source가 아직 브랜치 배포입니다.

### 8. 새 앱 추가 체크리스트

1. 규칙에 맞는 폴더 이름을 정합니다 (`^[a-z0-9][a-z0-9-]*$`, 장치 이름·`src` 아님, 이미 있는 폴더와 겹치지 않음).
2. 그 폴더에 페이지를 만듭니다 (예: `privacy/index.html`, `terms/index.html`, `support/index.html`). 모든 경로는 이식 가능해야 합니다 (5번). 링크는 그 폴더 안의 상대 경로나 사이트 루트(`/`, `/404.html`)만 씁니다.
3. 그 폴더에 `card.json`을 만듭니다. `since`는 오늘 날짜(UTC)이고 이미 있는 모든 카드의 `since`와 같거나 그 뒤여야 합니다. 링크는 실제 있는 파일을 가리키게 합니다.
4. **그 폴더만** 커밋하고 `main`에 push합니다. 루트 파일, `.github/`, 다른 폴더가 diff에 있으면 멈추세요.
5. GitHub의 Actions 탭에서 "Deploy Pages" 실행이 성공했는지, 실행 요약에 경고가 없는지 확인합니다.
6. https://hootchi.github.io/ 에 새 카드가 맨 뒤에 붙었는지, 기존 카드가 그대로인지, 새 링크가 모두 열리는지 확인합니다.

---

## English

### 1. An app owns exactly one top-level folder

- Each app owns exactly one top-level folder, e.g. `tuckaway/` → https://hootchi.github.io/tuckaway/
- Folder name: lowercase letters, digits and `-`, starting with a letter or digit (`^[a-z0-9][a-z0-9-]*$`), at most 100 characters, e.g. `tuckaway`, `pangka`, `word-hop`. Never a Windows device name (`con`, `aux`, `nul`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`; see 5). App publish tools refuse to publish under a folder name that breaks these rules.
- Never use `src`: the app publish tools refuse a repo that has `src/` or `package.json` at its root, taking it for a code repo.
- Never rename a folder once used: the privacy policy and support URLs registered in the stores would break.
- An app's publish tool and sessions write and delete files **only inside that app's folder**. They never touch root files, `.github/` or another app's folder.
- Every path in the folder follows the portable-path rule (5).

### 2. Studio files (apps never touch them)

`.github/` (this README, `workflows/pages.yml`, `build.mjs`, `test-build.mjs`) and the root files belong to the studio. They change only through a deliberate studio edit in this repo.

- The only root files are `404.html`, `.nojekyll`, `app-ads.txt`, `CNAME`, `.gitignore` and `.gitattributes`. Any other root file is still published, with a build warning. App files belong in the app's folder. An app that needs an `app-ads.txt` line gets it through a studio edit.
- Do not add a root `index.html`: the home page is **generated** from the app cards at deploy time. A committed root `index.html` (any letter case) is ignored with a warning.
- Do not add a root `package.json` (see 1).
- Never commit a `_site/` folder (`.gitignore` lists it).

### 3. The app card: `<app folder>/card.json`

The home page shows one card per app, built from the app folder's `card.json` (a UTF-8 JSON object of **at most 64 KiB = 65,536 bytes**). A folder without `card.json` simply has no card; its files are still deployed. The studio build does not read a `card.json` over 64 KiB and skips only that card (with a warning); app publish tools refuse to publish one.

| Field | | |
|---|---|---|
| `name` | required | app name, 1–80 characters, at least one that is not a space. A run of more than 30 characters without a space only gets a warning (it may not wrap on a phone). |
| `name_ko` | optional | Korean name, at most 80 |
| `summary` | required | one-line summary, 1–200, at least one character that is not a space |
| `summary_ko` | optional | Korean summary, at most 200 |
| `since` | required | the date the folder first appeared on the site, `"YYYY-MM-DD"` (a real date, UTC). See "The `since` rule" below. Never change it later. |
| `links` | optional | array of at most 10 `{ "label", "label_ko" (optional), "href" }`; `label` 1–60, `label_ko` at most 60 |
| `contact` | optional | contact email (rendered as a `mailto:` link) |

- **Text fields** (`name`, `name_ko`, `summary`, `summary_ko`, `label`, `label_ko`):
  - no control or format characters (Unicode `\p{Cc}`, `\p{Cf}`), e.g. tab, newline, zero-width space U+200B, ZWJ U+200D, bidi controls such as U+202E, soft hyphen U+00AD, BOM U+FEFF;
  - no lone surrogates (`\p{Cs}`, written in JSON as e.g. `"\ud800"`); a valid surrogate pair such as an emoji is fine;
  - no run of 3 or more combining marks (`\p{M}`);
  - a required field (`name`, `summary`) that breaks a rule skips the card, a link `label` that does drops the link, and an optional field that does is dropped alone.
- Cards are ordered by `since`, then by folder name, so a new app is always appended and never reorders or changes the existing cards.
- Every value is plain text; HTML is escaped and shows as text.
- Unknown keys are ignored.
- An `href` is either
  - a relative path inside the app folder: `privacy/`, `terms/`, `faq.html`, `support/#contact`. No leading `/`, no `..`, `\`, `//`, no scheme (`http:`, `javascript:`, ...), no spaces or control characters (write a space as `%20`), no `%2e`/`%2f`/`%5c`, no file or folder starting with a dot. The target file must exist in the app folder (`x/` means `x/index.html`); write folders with the trailing `/` (`privacy/`, not `privacy`); or
  - an absolute `https://` URL (used as is).

**The `since` rule.** `since` is the date (UTC) the folder first appeared on the site. A new card's `since` must be on or after every existing card's `since` (so the new card is appended) and must not be in the future. App publish tools refuse a future `since`. The studio build only warns when `since` is later than the build's UTC date, and still shows the card.

Example: the tuckaway card is shown in the Korean section above (same JSON).

**A card problem never fails the build.** Bad JSON or a bad required field hides only that app's card; a bad link drops only that link; a bad optional field drops only that field. Each problem shows up as a warning annotation on the Actions run and in its run summary. Every other card and every app's pages deploy as usual.

### 4. Size budget

The whole site (every app folder, the root files and the generated `index.html`) stays under **800 MB**; GitHub Pages sites are limited to 1 GB. Above 800 MB the build warns, and the run summary lists the size of each top-level folder. Do not commit large videos or build outputs.

### 5. Portable paths

Every path inside an app folder (the app folder name included):

- uses only `A-Z a-z 0-9 . _ -` in each segment (file or folder name): no spaces, no Hangul, no `:` or `\`;
- has no segment starting with `.` or ending with `.` (no `.well-known`, no `draft.`);
- has no segment longer than 100 bytes;
- is at most 200 bytes (UTF-8) as a whole, counted from the repo root with the app folder name (`tuckaway/privacy/index.html`);
- has no Windows device name as a segment: `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, in any letter case, with or without an extension (`con`, `Aux.html`, `nul.txt` are all out);
- never differs from another path only in letter case (`Page.html` and `page.html`, `img/` and `IMG/`); the warning names both paths.

**Why:** every app's publish tool clones this **whole** repo, and some run on Windows. One app committing a path Windows cannot create breaks the clone or checkout for **every other app's** Windows publish tool, even though that app has nothing to do with it.

- An app publish tool refuses to publish its own folder if it has any such path (including a path with `##[` in it or longer than 200 bytes).
- The studio build warns once for every such path (a bad folder name is reported once, for the folder) and still publishes it if it can.
- Except: a file or folder **anywhere** in the repo (root included) whose name contains `##[`, or whose path is longer than 200 bytes, is skipped with a warning and **not published** (a folder with everything in it). The upload step's `tar -v` prints every path, and the Actions runner reads `##[` anywhere in a log line as a command that can fail the step. The 200-byte limit also bounds the folder depth.
- Files and folders whose names are not valid UTF-8 are skipped with a warning. A file that cannot be copied is skipped with a warning, and only that file is left out.

### 6. How deploy works

- The GitHub Pages source is **GitHub Actions** (a studio setting). Jekyll never runs.
- A push to `main` (or a manual run) starts `.github/workflows/pages.yml`:
  1. `node .github/test-build.mjs`: self-test of the build script (it only uses throwaway fixture repos, so app content can never make it fail);
  2. `node .github/build.mjs "$RUNNER_TEMP/site"`: copies every file of the repo byte for byte into the runner's temp folder, **outside** the checkout (except `.git/`, `.github/` and a root `index.html`), and generates `index.html` there from the app cards;
  3. uploads that folder and deploys it. Only `main` deploys; a manual run from another branch only tests and builds.
- Workflow permissions: read only (`contents: read`) by default; only the deploy job gets `pages: write` and `id-token: write`. Each job must finish within 10 minutes. It runs Node 24, the tested version, with no dependency cache (there is no package manager).
- One run at a time per branch: a new run waits for the one in progress instead of cancelling it. A manual run from another branch never holds up a deploy from `main`.
- **Run summary:** each run's summary page lists the cards shown, the cards skipped with the reason, **every warning**, the total size and the size of each top-level folder. Warnings are also annotations on the run. In every line the build prints, `##[` is written `#%23[` (warnings and the run summary) or `# #[` (plain log lines).
- Not deployed: files and folders whose name starts with a dot (dropped by the upload step), symlinks (skipped with a warning), names that are not valid UTF-8 (skipped with a warning), and paths that contain `##[` or are longer than 200 bytes (skipped with a warning; see 5).
- The home page's description, styles, header and footer (`© <build year> Atto Studio`) live in `build.mjs` and are studio-owned.
- Local preview: `node .github/build.mjs <an empty folder outside the repo>` (the output folder must be empty or absent). Never commit a `_site/` folder.

### 7. One-time cutover to GitHub Actions deploys

The studio does this once, when switching to this setup. Keep the order: if the push lands while the source is still a branch, the branch deploy publishes the repo as is, without an `index.html`.

1. In the repo, Settings → Pages → Build and deployment → Source: choose **GitHub Actions**.
2. Push this change to `main`.
3. In the Actions tab, check that the "Deploy Pages" run for that push succeeded (both the build and the deploy job) and that its run summary shows no warnings.
4. Open https://hootchi.github.io/ , https://hootchi.github.io/tuckaway/privacy/ , https://hootchi.github.io/tuckaway/terms/ , https://hootchi.github.io/tuckaway/support/ and a missing path (the 404 page).
5. Check that **no** "pages-build-deployment" run was started for that push. If there is one, the source is still set to deploy from a branch.

### 8. Checklist: adding a new app

1. Pick a folder name that follows the rules (`^[a-z0-9][a-z0-9-]*$`, not a device name, not `src`, not already taken).
2. Put the app's pages in that folder (e.g. `privacy/index.html`, `terms/index.html`, `support/index.html`). Every path must be portable (5). Link only to paths inside the folder or to the site root (`/`, `/404.html`).
3. Add `card.json` to the folder: `since` is today (UTC) and on or after every existing card's `since`, and every link points to a file that exists.
4. Commit **only that folder** and push to `main`. Stop if the diff touches root files, `.github/` or another folder.
5. Check that the "Deploy Pages" run in the Actions tab succeeded and that its run summary shows no warnings.
6. Check https://hootchi.github.io/: the new card is appended at the end, the existing cards are unchanged, and every new link opens.
