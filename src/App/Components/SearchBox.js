import React, { forwardRef } from 'react';
import { Search as SearchIcon } from 'baseui/icon';
import { Input, SIZE } from 'baseui/input';

const SEARCH_HISTORY_KEY = 'browser.searchHistory';
const SEARCH_HISTORY_LIMIT = 6;

const loadSearchHistory = () => {
  try {
    const storedHistory = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY));
    return Array.isArray(storedHistory) ? storedHistory.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : [];
  } catch (error) {
    return [];
  }
};

const storeSearchHistory = (history) => {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, SEARCH_HISTORY_LIMIT)));
};

const SearchBox = forwardRef((props, ref) => {
  const [value, setValue] = React.useState('');
  const [history, setHistory] = React.useState(loadSearchHistory);
  const [focused, setFocused] = React.useState(false);

  const visibleHistory = history.filter((historyItem) => (
    !value.trim() || historyItem.toLowerCase().includes(value.trim().toLowerCase())
  ));

  const updateHistory = (nextHistory) => {
    setHistory(nextHistory);
    storeSearchHistory(nextHistory);
  };

  const runSearch = (input) => {
    const normalizedInput = input.trim();
    if (normalizedInput) {
      const updatedHistory = [
        normalizedInput,
        ...history.filter((historyItem) => historyItem.toLowerCase() !== normalizedInput.toLowerCase())
      ].slice(0, SEARCH_HISTORY_LIMIT);
      updateHistory(updatedHistory);
    }

    setFocused(false);
    props.searchAction(input);
  };

  const clearHistoryItem = (historyItemToClear) => {
    updateHistory(history.filter((historyItem) => historyItem !== historyItemToClear));
  };

  const clearAllHistory = () => {
    updateHistory([]);
  };

  const handleKeyDown = event => {
    switch (event.keyCode) {
      case 13: {
        runSearch(value);
        return;
      }
      case 27: {
        setFocused(false);
        return;
      }
      default:
        return;
    }
  };

  return (
    <div
      className="searchBoxContainer"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <Input
        id={props.id}
        inputRef={ref}
        placeholder={props.placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={e => handleKeyDown(e)}
        size={SIZE.default}
        startEnhancer={<SearchIcon size="22px" />}
        autoComplete="off"
        autocorrect="off"
        autosuggest="off"
        clearable="true"
        role="presentation"
        type="email" /* autocomplete hack */
        overrides={{
          Root: {
            style: {
              width: '100%'
            }
          },
          StartEnhancer: {
            style: {
              marginLeft: '0px',
              marginRight: '0px',
              paddingLeft: '0px',
              paddingRight: '0px',
              color: '#888888'
            }
          }
        }}
      />
      {
        focused && visibleHistory.length > 0
          ? (
            <div className="searchHistoryDropdown">
              <div className="searchHistoryHeader">
                <span>Recent searches</span>
                <button
                  className="searchHistoryClearAll"
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    clearAllHistory();
                  }}
                >
                  Clear All
                </button>
              </div>
              {visibleHistory.map((historyItem) => (
                <div
                  className="searchHistoryItem"
                  key={historyItem}
                >
                  <button
                    className="searchHistoryQuery"
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setValue(historyItem);
                      runSearch(historyItem);
                    }}
                  >
                    <span className="searchHistoryText">{historyItem}</span>
                  </button>
                  <button
                    className="searchHistoryClear"
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      clearHistoryItem(historyItem);
                    }}
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
          )
          : null
      }
    </div>
  )
});

export default SearchBox;
