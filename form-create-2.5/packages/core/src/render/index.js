import useCache from './cache';
import useRender from './render';
import extend from '@form-create/utils/lib/extend';
import {funcProxy} from '../frame/util';

export default function Render(handle) {
    extend(this, {
        $handle: handle,//handle实例
        fc: handle.fc, //FormCreate实例
        vm: handle.vm, //form-create组件实例
        $manager: handle.$manager, //manager实例
        vNode: new handle.fc.CreateNode(handle.vm), //CreateNode实例
    });

    // 代理
    funcProxy(this, {
        options() {
            return handle.options;
        },
        sort() {
            return handle.sort;
        }
    })

    this.initCache();
    this.initRender();
}

useCache(Render);
useRender(Render)
