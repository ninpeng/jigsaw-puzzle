# Jigsaw Bloom Sound Design

## Goal

밝고 게임스러운 캐주얼 감성을 유지하면서, 현재 퍼즐 플레이가 비어 보이는 문제를 `효과음 전용 오디오 레이어`로 해결한다. 첫 버전은 배경음 없이 시작하고, 클릭감과 상호작용 만족감을 올리는 짧은 고음질 파일 효과음만 도입한다.

## Product Direction

- 사운드 범위는 `효과음 세트만`으로 제한한다.
- 톤은 과하게 키즈스럽지 않은 `밝고 선명한 캐주얼 게임` 쪽으로 맞춘다.
- 사운드는 화면 전체를 덮는 연출보다 `행동에 대한 즉각적 피드백` 역할을 한다.
- 기본값은 `사운드 ON`이고, 사용자가 끌 수 있어야 한다.

## Sound Events

- `ui_click`
  - 홈 화면 버튼, 홈 복귀, 완료 화면 재시작 버튼
  - 길이 120ms 안팎, 날카롭지 않은 밝은 클릭음
- `puzzle_start`
  - 퍼즐 시작 직후
  - 짧은 상승음, 길이 250ms 안팎
- `piece_pickup`
  - 퍼즐 조각 집기 시작
  - 가벼운 톡 소리, 길이 90ms 안팎
- `piece_drop`
  - 조각을 놓았지만 스냅되지 않았을 때
  - pickup보다 약간 낮은 착지감, 길이 110ms 안팎
- `piece_snap`
  - 조각이 제자리에 붙었을 때
  - 만족감 있는 핵심 피드백, 길이 180ms 안팎
- `hint`
  - 힌트 버튼
  - 반짝이는 안내음, 길이 220ms 안팎
- `separate_edges`
  - 가장자리 분리 버튼
  - 정리되는 느낌의 넓은 효과, 길이 250ms 안팎
- `puzzle_complete`
  - 마지막 조각이 맞아 완료 화면으로 넘어가기 직전
  - 700ms 내외의 짧은 팬파레

## Technical Approach

- 파일 자산 기반 효과음만 사용한다.
- 오디오 재생은 React 전역 `SoundProvider`가 담당한다.
- 실제 재생 엔진은 `AudioContext + decoded AudioBuffer` 방식으로 구현한다.
  - 이유: 파일 음질을 유지하면서도 짧은 효과음 재생 지연을 줄일 수 있다.
  - 같은 효과음을 연속 재생해야 하는 `piece_pickup`, `piece_snap`에 유리하다.
- 브라우저 자동재생 제한 때문에 첫 사용자 상호작용에서만 `AudioContext.resume()`을 호출한다.
- 사운드 on/off 상태는 경량 저장소에 보관한다.
  - 현재 앱은 IndexedDB를 사용하지만, 이 설정값은 `localStorage`가 더 단순하다.

## Integration Points

- [App.tsx](/Users/bcchoi/jigsaw-puzzle/src/app/App.tsx)
  - `SoundProvider`를 앱 루트에 배치
  - 전역 첫 입력에서 오디오 언락
- [HomePage.tsx](/Users/bcchoi/jigsaw-puzzle/src/app/routes/HomePage.tsx)
  - `시작하기`, `계속하기`, `이미지 업로드` 버튼 클릭 시 `ui_click`
  - 퍼즐 시작 시 `puzzle_start`
  - 우측 컨트롤 영역에 `사운드 ON/OFF` 토글 추가
- [PlayPage.tsx](/Users/bcchoi/jigsaw-puzzle/src/app/routes/PlayPage.tsx)
  - `힌트`, `가장자리 분리`, `홈으로` 버튼과 완료 전환 시 사운드 호출
- [PuzzleBoard.tsx](/Users/bcchoi/jigsaw-puzzle/src/app/ui/PuzzleBoard.tsx)
  - `dragstart`: `piece_pickup`
  - `dragend` 후 스냅 실패: `piece_drop`
  - `dragend` 후 스냅 성공: `piece_snap`
- [CompletePage.tsx](/Users/bcchoi/jigsaw-puzzle/src/app/routes/CompletePage.tsx)
  - `다시 시작하기`, `홈으로 돌아가기`에 `ui_click`

## Assets

- 위치: `public/assets/audio/`
- 형식: 우선 `ogg`, 필요 시 `mp3` fallback 추가 가능
- 파일명:
  - `ui-click.ogg`
  - `puzzle-start.ogg`
  - `piece-pickup.ogg`
  - `piece-drop.ogg`
  - `piece-snap.ogg`
  - `hint.ogg`
  - `separate-edges.ogg`
  - `puzzle-complete.ogg`
- 파일 기준:
  - 지나치게 저음이 강하지 않을 것
  - 모바일 스피커에서도 뭉개지지 않을 것
  - 완료음을 제외하면 모두 300ms 이내로 유지할 것

## UX Rules

- 사운드는 기본 `ON`
- 토글은 홈 화면과 플레이 화면 중 적어도 한 곳에서 접근 가능해야 한다.
- 음소거 시 모든 효과음을 즉시 중단할 필요는 없고, 새 재생만 막으면 충분하다.
- 사운드가 로드 실패하거나 브라우저가 재생을 거부해도 게임은 정상 플레이 가능해야 한다.
- 완료 팬파레는 짧아야 하며, 완료 화면을 지연시키지 않는다.

## Testing

- 사운드 설정의 기본값과 토글 저장이 유지되는지 테스트
- 오디오가 잠긴 상태에서 첫 상호작용 후 언락되는지 테스트
- mute 상태에서는 `play(soundId)` 호출이 실제 재생을 시도하지 않는지 테스트
- `HomePage`, `PlayPage`에서 주요 버튼이 올바른 사운드 ID를 호출하는지 테스트
- `PuzzleBoard`에서 pickup/drop/snap 이벤트가 중복되지 않고 맞는 타이밍에 발화되는지 테스트
- 브라우저 수동 점검으로 음량, 반복 피로도, 완료 팬파레 길이 확인

## Out Of Scope

- 배경음
- 볼륨 슬라이더
- 씬별 테마 음악
- 사용자 정의 사운드팩
- 네트워크 기반 오디오 로딩
