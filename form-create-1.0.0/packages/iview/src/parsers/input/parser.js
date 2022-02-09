import {BaseParser} from '@form-create/core';
import {$set} from '@form-create/utils';


export default class Parser extends BaseParser {
    init() {
        let {props} = this.rule;
        if (props.autosize && props.autosize.minRows)
            //开启input组件的文本域，并设置minRows为2
            $set(props, 'rows', props.autosize.minRows || 2);
    }
}
