import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import HomePage from './pages/HomePage';
import PageLayout from './components/PageLayout';
import Settings from './components/Settings';
import GtxPlanner from './components/GtxPlanner';
import WorkHoursCalculator from './components/WorkHoursCalculator';
import HolidayManager from './components/HolidayManager';
import TodoList from './components/TodoList';
import WorkoutLog from './components/WorkoutLog';
import MapleMvpCalculator from './components/MapleMvpCalculator';
import FcFeeCalculator from './components/FcFeeCalculator';
import DateCalculator from './components/DateCalculator';
import LoanMemo from './components/LoanMemo';

// 앱 메뉴 목록. 기능을 추가하려면 여기에 항목(+ Component)을 늘리면 됩니다.
const MENUS = [
  {
    id: 'todo',
    icon: '✅',
    title: '오늘의 할일',
    desc: '할 일 등록·체크 (자정마다 초기화)',
    Component: TodoList,
  },
  {
    id: 'workout',
    icon: '🏋️',
    title: '운동 기록',
    desc: '상체·하체 번갈아 · 달력에 기록',
    Component: WorkoutLog,
  },
  {
    id: 'gtx',
    icon: '🚆',
    title: 'GTX-A 연계 출발 안내',
    desc: '강남구청·선릉 → 수서 환승 → 동탄',
    Component: GtxPlanner,
  },
  {
    id: 'work',
    icon: '🕒',
    title: '근무시간 계산기',
    desc: '유연근무 · 남은 시간과 하루 평균 계산',
    Component: WorkHoursCalculator,
  },
  {
    id: 'holidays',
    icon: '📅',
    title: '공휴일 관리',
    desc: '공휴일 직접 등록·제외 (근무일 계산에 반영)',
    Component: HolidayManager,
  },
  {
    id: 'maplemvp',
    icon: '🍁',
    title: '메이플 MVP 계산기',
    desc: '13주 누적 결제로 등급·목표까지 실비용 계산',
    Component: MapleMvpCalculator,
  },
  {
    id: 'fcfee',
    icon: '⚽',
    title: 'FC온라인 수수료 계산기',
    desc: '이적시장 판매 실수령·목표 등록가 계산',
    Component: FcFeeCalculator,
  },
  {
    id: 'datecalc',
    icon: '📆',
    title: '날짜 계산기',
    desc: '두 날짜 사이 일수 · 기준일 ± 기간 계산',
    Component: DateCalculator,
  },
  {
    id: 'loan',
    icon: '💸',
    title: '정산 관리',
    desc: '사람별 상세 내역 입력·합산 관리',
    Component: LoanMemo,
  },
];

export default function App() {
  const [view, setView] = useState('home'); // 'home' | 메뉴 id

  const goHome = () => setView('home');

  // 안드로이드 하드웨어 뒤로가기: 상세 메뉴에 있으면 홈으로,
  // 홈이면 확인 창을 띄운 뒤 확인 시에만 앱 종료.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    let handle;
    CapApp.addListener('backButton', () => {
      if (viewRef.current !== 'home') {
        setView('home');
      } else if (window.confirm('앱을 종료하시겠습니까?')) {
        CapApp.exitApp();
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, []);

  const active = MENUS.find((m) => m.id === view);

  let content;
  if (view === 'settings') {
    content = (
      <PageLayout title="설정" onBack={goHome}>
        <Settings />
      </PageLayout>
    );
  } else if (active) {
    content = (
      <PageLayout title={active.title} onBack={goHome}>
        <active.Component />
      </PageLayout>
    );
  } else {
    content = (
      <HomePage
        menus={MENUS}
        onSelect={setView}
        onOpenSettings={() => setView('settings')}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        // 상태바/노치·하단 내비바(엣지 투 엣지) 침범 방지: 기본 여백 + safe-area inset
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
      }}
    >
      {content}
    </div>
  );
}
