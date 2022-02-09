/*
 * @Author: your name
 * @Date: 2022-02-01 15:22:17
 * @LastEditTime: 2022-02-04 10:37:01
 * @LastEditors: your name
 * @Description: 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * @FilePath: \code\form-create-2.5\packages\core\src\render\index.js
 */
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
        vNode: new handle.fc.CreateNode(handle.vm),
    });

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
