import preval from 'preval.macro';
import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalButton,
    ROLE,
    SIZE
} from 'baseui/modal';

import { Link } from 'react-router-dom';

const About = (props) => {
    const dateTimeStamp = preval`module.exports = new Date().toLocaleString();`

    return (
        <Modal
            isOpen={props.isOpen}
            onClose={() => props.onClose()}
            closeable
            animate
            autoFocus
            size={SIZE.default}
            role={ROLE.dialog}>
            <ModalHeader>LoboReader<br />for Internet Archive</ModalHeader>
            <ModalBody>
                Build date: {dateTimeStamp}<br /><br />
                LoboReader is an unofficial reader for the Internet Archive "Magazine Rack".<br/><br/>
                For changelog, docs & licensing please visit project page on GitHub.
            </ModalBody>
            <ModalFooter>
            <Link to={{ pathname: "https://github.com/gitGalu" }} target="_blank"><ModalButton kind="primiary">Visit GitHub</ModalButton></Link>
            </ModalFooter>
        </Modal>
    )
}

export default About;
