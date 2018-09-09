// BASIC COUNTER
async function* counterReducer(actionDelegator) {
  let state = 0;
  yield state;
  for await (const action of actionDelegator) { // awaits action to be yielded from "actionDelegator"
    switch (action.type) {
      case "INCREMENT":
        yield ++state;
        break
      case "DECREMENT":
        yield --state;
        break;
      default:
        yield state;
        break;
    }
  }
}

// TODO LIST
async function* todoReducer(actionDelegator) {
  let state = {};
  const guid = () => Math.random().toString(36).slice(2);
  yield Object.values(state);
  for await (const action of actionDelegator) { // awaits action to be yielded from "actionDelegator"
    switch (action.type) {
      case "ADD_TODO":
        const id = guid();
        state[id] = { ...action.payload, id };
        yield Object.values(state);
        break;
      case "REMOVE_TODO":
        delete state[action.payload.id];
        yield Object.values(state);
        break;
      default:
        yield Object.values(state);
        break;
    }
  }
}

// REMOTE FETCH EXAMPLE
async function* postReducer(actionDelegator) {
  let state = {};
  yield Object.values(state);
  for await (const action of actionDelegator) { // awaits action to be yielded from "actionDelegator"
    switch (action.type) {
      case "FETCH_POST":
        const { id } = action.payload;
        const post = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`).then(res => res.json());
        state[post.id] = { id: post.id, title: post.title, body: post.body };
        yield Object.values(state);
      default:
        yield Object.values(state);
        break;
    }
  }
}

function createStore(rootReducer) {
  let state;
  let callback; // Resolves the recurring promise inside actionDelegator's infinite loop. Actions yielded on each call.
  const queue = [];

  // Receives actions from store.dispatch and yields them to reducers
  const actionDelegator = async function* (numOfReducers) {
    while (true) {
      while(queue.length) {
        const action = queue.shift();
        for (let i = 0; i < numOfReducers; i++) yield action;
      }
      await new Promise(i => callback = i);
      callback = null;
    }
  }(rootReducer.__NUM_OF_REDUCERS__);

  // Receives values from combineReducers and mutates store's state
  void async function stateUpdater() {
    for await (const newState of rootReducer(actionDelegator)) {
      state = { ...state, ...newState };
    }
  }();

  // Store public interface
  return {
    getState() { return state; },
    dispatch(action) {
      if (callback) callback();
      queue.push(action);
    }
  }
}

function combineReducers(reducers) {
  const rootReducer = function(actionDelegator) {
    const reducerList = Object.entries(reducers).map(([name, reducer]) => [name, reducer(actionDelegator)]);
    return async function* () {
      const state = {};
      while (true) {
        await Promise.all(reducerList.map(async ([name, generator]) => {
          const subState = await generator.next();
          state[name] = subState.value;
        }));
        yield state;
      }
    }();
  };

  Object.defineProperty(rootReducer, "__NUM_OF_REDUCERS__", {
    value: Object.keys(reducers).length,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  return rootReducer;
}

window.store = createStore(combineReducers({
  counter: counterReducer,
  todos: todoReducer,
  posts: postReducer,
}));
