import {
    Modal,
    ModalHeader,
    ModalBody,
    ROLE,
    SIZE
} from 'baseui/modal';

import {
    StyledBody,
  } from "baseui/card";

const StandaloneWarning = (props) => {
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
               <p>LoboReader is an unofficial reader for the Internet Archive "Magazine Rack".</p>
               <p></p>
               <p>You have to add it to your Home screen and launch it from the app icon:</p>
               <ul>
               <li>When using Safari (iOS and iPadOS), tap the Share button and select "Add to Home Screen".</li>
               <li>When using Chrome (Android), tap the menu overflow button (three dots) and select "Add to Home screen".</li>
               </ul>
               </StyledBody>
            </ModalBody>
        </Modal>
    )
}

export default StandaloneWarning;
