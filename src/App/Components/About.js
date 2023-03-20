import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import preval from 'preval.macro';
import { CSVLink } from "react-csv";
import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalButton,
    ROLE,
    SIZE
} from 'baseui/modal';
import { StyledLink } from "baseui/link";
import { Link } from 'react-router-dom';
import db from '../Components/Db';

const About = forwardRef((props, ref) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const dateTimeStamp = preval`module.exports = new Date().toLocaleString();`
    const csvLinkEl = React.useRef();
    const [data, setData] = useState([]);

    useImperativeHandle(ref, () => {
        return {
            showDrawer: showDrawer,
            hideDrawer: hideDrawer
        }
    });

    const showDrawer = (identifier, title) => {
        setDrawerOpen(true);
    };

    const hideDrawer = () => {
        setDrawerOpen(false);
    };

    const headers = [
        { label: "identifier", key: "id" },
        { label: "title", key: "title" },
        { label: "page", key: "page" },
        { label: "archived", key: "archived" },
        { label: "read", key: "read" }
    ];

    const downloadReport = async () => {
        db.collection
            .toArray()
            .then((items) => {
                setData(items);
            });
    }

    useEffect(() => {
        if (csvLinkEl.current != undefined) {
            setTimeout(() => {
                csvLinkEl.current.link.click();
            });
        }
    }, [data]);

    return (
        <Modal
            isOpen={drawerOpen}
            onClose={hideDrawer}
            closeable
            animate
            autoFocus
            size={SIZE.default}
            role={ROLE.dialog}>
            <ModalHeader>LoboReader<br />for Internet Archive</ModalHeader>
            <ModalBody>
                Build date: {dateTimeStamp}<br /><br />
                LoboReader is an unofficial mobile reader for the Internet Archive "Magazine Rack".<br /><br />
                <StyledLink animateUnderline onClick={downloadReport}>Click here</StyledLink> to download your reading list.<br /><br />
                <CSVLink headers={headers} data={data} ref={csvLinkEl} filename="LoboReader-export.csv"></CSVLink>
                For changelog, docs &amp; licensing please visit project page on GitHub.
            </ModalBody>
            <ModalFooter style={{paddingBottom: '24px'}}>
                <Link to={{ pathname: "https://github.com/gitGalu/LoboReader" }} target="_blank"><ModalButton kind="primiary">Visit GitHub</ModalButton></Link>
            </ModalFooter>
        </Modal>
    )
});

export default About;
