import React, { forwardRef } from 'react';
import { Search as SearchIcon } from 'baseui/icon';
import { Input, SIZE } from 'baseui/input';

const SearchBox = forwardRef((props, ref) => {
    const [value, setValue] = React.useState('');

    const handleKeyDown = event => {
        switch (event.keyCode) {
            case 13: {
                props.searchAction(value);
                return;
            }
        }
    };

    return (
        <Input
            id={props.id}
            placeholder={props.placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => handleKeyDown(e)}
            size={SIZE.compact}
            startEnhancer={<SearchIcon size="22px" />}
            autoComplete="off"
            autocorrect="off"
            autosuggest="off"
            role="presentation"
            type="email"
            overrides={{
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
    )
});

export default SearchBox;
