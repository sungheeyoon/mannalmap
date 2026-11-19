#!/usr/bin/env bash
# CI 의 e2e 차선이 apt 로 받는 꾸러미(.deb)를 캐시와 주고받는다(G-169 항목 4, 까닭은 `.github/workflows/verify.yml` 의 `anon` 그 단계 주석).
#
#   ci-apt-debs.sh restore <캐시 폴더>  — 캐시의 .deb 가운데 apt 목록의 SHA256 과 맞는 것만 apt 의 받는 자리에 넣는다
#   ci-apt-debs.sh collect <캐시 폴더>  — 받는 자리의 .deb 가운데 지금 깔린 판만 캐시 폴더로 거둔다
#
# **넣기 전에 해시를 우리가 본다.** apt 는 받는 자리(`Dir::Cache::Archives`)에 이름과 크기가 맞는 파일이 있으면 받지도 해시를 보지도 않는다
# (apt `apt-pkg/acquire-item.cc` 의 `pkgAcqArchive` 생성자 「Check if we already downloaded the file」). 같은 크기로 깨진 파일이 캐시에 들면
# dpkg 가 실패하고, 실패한 실행은 캐시를 안 남기니 다음 실행이 같은 것을 되살린다 — 스스로 낫지 않는다. 그래서 꾸러미의 이름 · 판으로
# `apt-cache show` 가 든 SHA256(이미지의 서명된 목록)과 견주고, 안 맞거나 목록에 없는 파일은 버린다. 버린 꾸러미는 apt 가 미러에서 받는다.
#
# **거두기는 지금 깔린 판만** — 되살린 옛 판을 다시 담으면 판이 바뀔 때마다 캐시가 커진다.
#
# 시험은 `APT_ARCHIVES` 로 받는 자리를, `SUDO` 로 권한 명령을 바꾼다(`scripts/ci-apt-debs.test.ts`).
set -euo pipefail

archives="${APT_ARCHIVES:-/var/cache/apt/archives}"
sudo_cmd="${SUDO-sudo}"
mode="${1:?restore 나 collect}"
dir="${2:?캐시 폴더}"

field() { dpkg-deb --field "$1" "$2"; }

case "$mode" in
  restore)
    mkdir -p "$dir"
    shopt -s nullglob
    for deb in "$dir"/*.deb; do
      name="$(field "$deb" Package)"
      version="$(field "$deb" Version)"
      actual="$(sha256sum "$deb" | cut -d' ' -f1)"
      # 같은 이름 · 판의 기록이 여럿(아키텍처 변종)일 수 있다 — 그 가운데 하나와 맞으면 된다. 파이프로 `grep -q` 에 물리지 않는다 —
      # 일찍 닫으면 `pipefail` 이 apt-cache 의 SIGPIPE 를 실패로 읽는다
      records="$(apt-cache show "$name=$version" 2>/dev/null || true)"
      if grep -qx "SHA256: $actual" <<<"$records"; then
        $sudo_cmd cp "$deb" "$archives/"
        echo "넣음 $(basename "$deb")"
      else
        echo "버림 $(basename "$deb") — apt 목록의 SHA256 과 안 맞거나 목록에 없다"
      fi
    done
    ;;
  collect)
    rm -rf "$dir"
    mkdir -p "$dir"
    shopt -s nullglob
    for deb in "$archives"/*.deb; do
      name="$(field "$deb" Package)"
      version="$(field "$deb" Version)"
      if [ "$(dpkg-query -W -f '${Status} ${Version}' "$name" 2>/dev/null || true)" = "install ok installed $version" ]; then
        cp "$deb" "$dir/"
        echo "거둠 $(basename "$deb")"
      fi
    done
    ;;
  *)
    echo "모르는 갈래: $mode" >&2
    exit 2
    ;;
esac
