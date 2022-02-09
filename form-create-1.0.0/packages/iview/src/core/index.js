import components from '../components';
import parsers from '../parsers';
import getConfig from './config';
import getGlobalApi from './api';
import nodes from './nodes';
import formRender from './form';
import createFormCreate, {Creator, VNode} from '@form-create/core';
import makers from '../makers';
import {isPlainObject, toString} from '@form-create/utils';

VNode.use(nodes);

export const drive = {
    ui: process.env.UI,
    version: process.env.VERSION,
    formRender,
    components, //自定义组件配置对象
    parsers,
    makers,
    getGlobalApi, //合并全局api和不同库的api
    getConfig, //默认的option配置
};

// 执行工厂函数createFormCreate
const {FormCreate, install} = createFormCreate(drive);

Creator.prototype.event = function (key, value) {
    let event;

    if (!isPlainObject(key)) {
        event = {[key]: value}
    } else {
        event = key;
    }
    // 为事件添加iview的前缀on-
    Object.keys(event).forEach((eventName) => {
        const name = toString(eventName).indexOf('on-') === 0 ? eventName : `on-${eventName}`;
        this.on(name, event[eventName]);
    });
    return this;
};

if (typeof window !== 'undefined') {
    window.formCreate = FormCreate;
    if (window.Vue) {
        // 执行install方法，里面会调用Vue.use
        install(window.Vue);
    }
}

export default FormCreate;
