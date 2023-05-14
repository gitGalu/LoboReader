import {
    Modal,
    ModalHeader,
    ModalBody,
    ROLE,
    SIZE
} from 'baseui/modal';
import React from 'react';

import {
    StyledBody,
} from "baseui/card";

const StandaloneWarning = ((props) => {
    const [dismissVisible, setDismissVisible] = React.useState(false);

    setTimeout(() => {
        setDismissVisible(true);
    }, 5000);

    const handleButtonClick = () => {
        setDismissVisible(false);
        props.onDismiss();
    }

    return (
        <Modal
            isOpen={true}
            closeable={false}
            animate
            size={SIZE.default}
            role={ROLE.alertdialog}>
            <ModalHeader>LoboReader<br />for Internet Archive</ModalHeader>
            <ModalBody className="doubleSpace">
                <StyledBody>
                    <p>LoboReader is an unofficial mobile reader for the Internet Archive "Magazine Rack".</p>
                    <p>For best experience, please use it in standalone PWA mode:</p>
                    <ul>
                        <li>In Safari (iOS and iPadOS), tap the Share button and scroll to "Add to Home Screen" option.</li>
                        <li>In Chrome (Android), tap the menu overflow button (three dots in the corner) and select "Add to Home screen".</li>
                    </ul>
                    {dismissVisible ?
                        <p onClick={handleButtonClick} className="dotted">Click here only if you have trouble proceeding or if you use unsupported browser.</p>
                        : <p></p>}
                </StyledBody>
            </ModalBody>
        </Modal>
    )
});

export default StandaloneWarning;
