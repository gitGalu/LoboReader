import React, { useLayoutEffect, useRef, useState } from 'react';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Search as SearchIcon } from 'baseui/icon';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { ListItem, ListItemLabel } from 'baseui/list';
import InternetArchive from './InternetArchive';
import { groupResultsByPage, parseSearchResponse } from './FullTextSearch';
import { getPageThumbnailUrl } from './pageThumbnails';

const MIN_QUERY_LENGTH = 2;
const RESULT_THUMB_WIDTH = 48;

const resultOverrides = (isCurrent) => ({
  Root: {
    props: { 'aria-current': isCurrent ? 'page' : undefined },
    style: { backgroundColor: 'transparent', width: '100%', textAlign: 'left' }
  },
  // Thumbnail flush with the status line's left edge, its top on the title's
  // line (content padding 4px + the label's own 14px top padding).
  ArtworkContainer: { style: { alignSelf: 'flex-start', paddingTop: '18px', paddingLeft: 0, paddingRight: '14px' } },
  Content: { style: { paddingTop: '4px', paddingBottom: '4px', paddingRight: 0, height: 'auto' } }
});

const labelOverrides = {
  LabelContent: { style: { fontSize: '15px', lineHeight: '20px', fontWeight: 600 } },
  LabelDescription: { style: { marginTop: '4px' } }
};

const ResultThumb = ({ identifier, pageIndex, isCurrent }) => (
  <span className={isCurrent ? 'readerSearchThumb readerSearchThumb--current' : 'readerSearchThumb'}>
    <img
      src={getPageThumbnailUrl(identifier, pageIndex)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  </span>
);

export const formatPageLabel = (pageIndex, pageCount, printedPageNumbers) => {
  const printed = printedPageNumbers?.[pageIndex];
  return printed ? `p. ${printed}` : `${pageIndex + 1} of ${pageCount}`;
};

// Search inside the current issue. Lives inside the page overview and keeps
// its query and results while the issue is open, so after jumping to a result
// the next one is a single tap away.
function PageSearch({ identifier, source, pageCount, currentPage, printedPageNumbers, active, onSelect, onExit }) {
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ status: 'idle', submitted: '', results: [] });

  // Layout effect: runs within the tap that opened search, so iOS still
  // allows focusing the field and showing the keyboard.
  useLayoutEffect(() => {
    if (active && search.status === 'idle') {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const runSearch = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      return;
    }

    const requestId = ++requestRef.current;
    inputRef.current?.blur();
    setSearch((state) => ({ ...state, status: 'loading', submitted: q }));

    try {
      const json = await InternetArchive.FullTextAPI.search({ identifier, source, q });
      if (requestId !== requestRef.current) {
        return;
      }

      const { indexed, results } = parseSearchResponse(json, pageCount);
      setSearch({ status: indexed ? 'done' : 'unindexed', submitted: q, results: groupResultsByPage(results) });
    } catch (err) {
      if (requestId === requestRef.current) {
        setSearch({ status: 'error', submitted: q, results: [] });
      }
    }
  };

  const renderStatus = () => {
    switch (search.status) {
      case 'loading':
        return 'Searching…';
      case 'unindexed':
        return 'This issue has no searchable text.';
      case 'error':
        return 'Search failed. Check your connection and try again.';
      case 'done': {
        const pages = search.results.length;
        const matches = search.results.reduce((sum, group) => sum + group.count, 0);
        if (pages === 0) {
          return `No matches for “${search.submitted}”.`;
        }

        return `${matches} ${matches === 1 ? 'match' : 'matches'} on ${pages} ${pages === 1 ? 'page' : 'pages'}`;
      }
      default:
        return null;
    }
  };

  return (
    <div className="readerSearch" hidden={!active}>
      <div className="readerSearchResults">
        {search.status !== 'idle' && (
          <div className="readerSearchStatus" role="status">{renderStatus()}</div>
        )}
        {search.status === 'done' && search.results.length > 0 && (
          <ul className="readerSearchList">
            {search.results.map((result) => {
              const isCurrent = result.pageIndex === currentPage;
              const pageLabel = formatPageLabel(result.pageIndex, pageCount, printedPageNumbers);

              return (
                <li key={result.pageIndex}>
                  <ListItem
                    aria-label={`${pageLabel}, ${result.count} ${result.count === 1 ? 'match' : 'matches'}`}
                    artwork={() => (
                      <ResultThumb identifier={identifier} pageIndex={result.pageIndex} isCurrent={isCurrent} />
                    )}
                    artworkSize={RESULT_THUMB_WIDTH}
                    onClick={() => onSelect(result.pageIndex)}
                    overrides={resultOverrides(isCurrent)}>
                    <ListItemLabel
                      overrides={labelOverrides}
                      description={result.snippets.map((snippet, snippetIndex) => (
                        <span key={snippetIndex} className="readerSearchSnippet">
                          {snippet.map((segment, index) => (segment.match
                            ? <b key={index}>{segment.text}</b>
                            : <React.Fragment key={index}>{segment.text}</React.Fragment>))}
                        </span>
                      ))}>
                      <span className="readerSearchTitle">
                        <span>{pageLabel}</span>
                        {result.count > 1 && <span className="readerSearchMeta">{result.count} matches</span>}
                        {isCurrent && <span className="readerSearchMeta">Current page</span>}
                      </span>
                    </ListItemLabel>
                  </ListItem>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* At the bottom, next to the footer's search button and the thumb; the
          page overview keeps it above the on-screen keyboard (visualViewport). */}
      <form className="readerSearchBar" role="search" onSubmit={runSearch}>
        <Input
          inputRef={inputRef}
          // Not type="search": Safari adds its own (blue) clear button to those,
          // next to Base Web's clearable one.
          type="text"
          inputMode="search"
          size={INPUT_SIZE.default}
          placeholder="Search this issue"
          aria-label="Search this issue"
          autoComplete="off"
          clearable
          // Escape is ours: it leaves search (see PageThumbnailGrid).
          clearOnEscape={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          startEnhancer={<SearchIcon size="22px" />}
          overrides={{
            Root: { style: { flex: '1 1 auto', minWidth: 0 } },
            StartEnhancer: {
              style: { marginLeft: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0, color: '#888888' }
            },
            Input: { props: { enterKeyHint: 'search', autoCorrect: 'off', spellCheck: false } }
          }}
        />
        <Button type="button" kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={onExit}>
          Cancel
        </Button>
      </form>
    </div>
  );
}

export default PageSearch;
