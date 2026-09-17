# 데굴데굴 추첨기

구슬을 굴려 당첨자를 뽑는 추첨기입니다.

[사이트 열기](https://yoonyoons.github.io/deguldegul/)

## 기능

- 이름을 쉼표나 줄바꿈으로 구분해 입력합니다.
  - `이름*3`: 그 이름의 구슬을 3개 넣습니다.
  - `이름/2`: 가중치를 줍니다.
- 당첨 순위: 첫번째, 마지막, n번째, 여러명(범위)
- 맵 4종, 스킬, 녹화, 다크 모드, 미니맵, 빨리 감기
- `?names=홍길동,김철수` 링크로 명단을 채울 수 있습니다.
- **구슬 꾸미기**: 이름마다 이미지를 등록하고 설정에서 **커스텀 구슬**을 켜면 그 이름의 구슬에 이미지가 입혀집니다. 이미지는 브라우저(IndexedDB)에만 저장됩니다.

## 개발

```shell
> yarn
> yarn dev
```

## 빌드

```shell
> yarn build
```

`main` 브랜치에 push하면 GitHub Actions가 빌드해서 `gh-pages` 브랜치로 배포합니다.

## 출처와 라이선스

이 프로젝트는 lazygyu의 [Marble Roulette](https://github.com/lazygyu/roulette)을 바탕으로 만들었습니다.
원작 소스 코드는 [MIT 라이선스](./LICENSE)를 따르며, 원작자의 저작권 고지를 그대로 유지합니다.

"Marble Roulette"와 "마블 룰렛"은 lazygyu의 상표이며, 이 프로젝트는 원작자와 관련이 없습니다.
