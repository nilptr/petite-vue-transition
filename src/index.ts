import type { createApp } from 'petite-vue';

type Directive = Exclude<Parameters<ReturnType<typeof createApp>['directive']>[1], undefined>;

type ElementWithTransition = Element & {
  _name: string;
  _duration: [number, number]; // [enterDuration, leaveDuration]
  // not used, just to make `ElementWithTransition` indexable by `TransitionArgument`
  _show: boolean;

  _endId: number;
};

type CSSTransitionInfo = {
  propCount: number;
  timeout: number;
  hasTransform: boolean;
};

const DefautlTransitionName = 'v';

enum TransitionArgument {
  Name = 'name',
  Duration = 'duration',
  Show = 'show',
}

const DefaultArg = TransitionArgument.Show;

const propsToClean = ['_name', '_duration', '_show', '_endId'] as const;

const transition: Directive = ctx => {
  const { arg, effect } = ctx;
  const el = ctx.el as ElementWithTransition;

  if (arg && isTransitionArugument(arg) && arg !== DefaultArg) {
    saveArgument(el, arg as TransitionArgument, ctx.get());
    return;
  }

  let mounted = false;
  const originalDisaplay = getElementDisplay(el);
  effect(() => {
    const show = ctx.get();

    if (!mounted) {
      setElementDisplay(el, show ? originalDisaplay : 'none');
      mounted = true;
      return;
    }

    const { _name: name = DefautlTransitionName, _duration: duration } = el;
    const enterFromClass = `${name}-enter-from`;
    const enterActiveClass = `${name}-enter-active`;
    const enterToClass = `${name}-enter-to`;
    const leaveFromClass = `${name}-leave-from`;
    const leaveActiveClass = `${name}-leave-active`;
    const leaveToClass = `${name}-leave-to`;
    const enterDuration = duration?.[0];
    const leaveDuration = duration?.[1];

    function finishEnter(done?: () => void | null) {
      removeTransitionClass(el, enterActiveClass);
      removeTransitionClass(el, enterToClass);
      done?.();
    }

    function finishLeave(done?: () => void | null) {
      removeTransitionClass(el, leaveActiveClass);
      removeTransitionClass(el, leaveToClass);
      done?.();
    }

    if (show) {
      finishLeave();
      const resolve = finishEnter;
      addTransitionClass(el, enterActiveClass);
      addTransitionClass(el, enterFromClass);
      setElementDisplay(el, originalDisaplay);
      nextFrame(() => {
        removeTransitionClass(el, enterFromClass);
        addTransitionClass(el, enterToClass);
        whenTransitionEnd(el, enterDuration, resolve);
      });
    } else {
      finishEnter();
      const resolve = () => finishLeave(() => {
        setElementDisplay(el, 'none');
      });
      addTransitionClass(el, leaveFromClass);
      // force reflow so *-leave-from classes immediately take effect (#2593)
      // https://github.com/vuejs/core/issues/2593
      forceReflow();
      addTransitionClass(el, leaveActiveClass);
      nextFrame(() => {
        removeTransitionClass(el, leaveFromClass);
        addTransitionClass(el, leaveToClass);
        whenTransitionEnd(el, leaveDuration, resolve);
      });
    }
  });

  return () => {
    propsToClean.forEach(p => delete el[p]);
  };
};

export default transition;

function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer
// numbers in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down
// (i.e. acting as a floor function) causing unexpected behaviors
function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(',', '.')) * 1000;
}

// Synchronously force layout to put elements into a certain state
function forceReflow() {
  return document.body.offsetHeight;
}

function getTimeout(delays: string[], durations: string[]): number {
  while (delays.length < durations.length) {
    delays = delays.concat(delays);
  }

  return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
}

function getTransitionInfo(el: Element): CSSTransitionInfo {
  const styles = window.getComputedStyle(el);
  // JSDOM may return undefined for transition properties
  const getStyleProperties = (key: string) => (styles[key as any] as string || '').split(', ');
  const transitionDelays = getStyleProperties('transitionDelay');
  const transitionDurations = getStyleProperties('transitionDuration');
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations);

  let timeout = 0;
  let propCount = 0;
  if (transitionTimeout > 0) {
    timeout = transitionTimeout;
    propCount = transitionDurations.length;
  }

  const hasTransform = /\b(transform|all)(,|$)/.test(styles.transitionProperty);

  return {
    timeout,
    propCount,
    hasTransform,
  };
}

let endId = 0;
function whenTransitionEnd(
  el: ElementWithTransition,
  explicitTimeout: number | null | undefined,
  resolve: () => void,
) {
  const id = (el._endId = ++endId);
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve();
    }
  };

  if (explicitTimeout) {
    setTimeout(resolveIfNotStale, explicitTimeout);
  }

  const { timeout, propCount } = getTransitionInfo(el);

  const end = () => {
    el.removeEventListener('transitionend', onEnd);
    resolveIfNotStale();
  };
  let ended = 0;
  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);
  el.addEventListener('transitionend', onEnd);
}

function addTransitionClass(el: Element, cls: string) {
  cls.split(/\s+/).forEach(c => c && el.classList.add(c));
}

function removeTransitionClass(el: Element, cls: string) {
  cls.split(/\s+/).forEach(c => c && el.classList.remove(c));
}

function getElementDisplay(el: Element): string {
  return (el as unknown as HTMLElement)?.style?.display || '';
}

function isHTMLElement(el: Element): el is HTMLElement {
  return !!(el as HTMLElement).style;
}

function setElementDisplay(el: Element, display: string) {
  if (isHTMLElement(el)) {
    el.style.display = display;
  }
}

function saveArgument(el: ElementWithTransition, arg: TransitionArgument, val: any) {
  let value = val;
  if (arg === TransitionArgument.Duration) {
    // TODO: normalize duration
    if (!Array.isArray(val)) {
      value = [val, val];
    }
  }
  (el[`_${arg}`] as any) = value;
}

const ArgSet = new Set<String>([
  TransitionArgument.Name,
  TransitionArgument.Duration,
  TransitionArgument.Show,
]);
function isTransitionArugument(arg: string): arg is TransitionArgument {
  return ArgSet.has(arg);
}
