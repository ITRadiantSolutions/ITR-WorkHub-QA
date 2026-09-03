import * as React from 'react';
import styles from './ItrOne.module.scss';
import { IItrOneProps } from './IItrOneProps';
import { escape } from '@microsoft/sp-lodash-subset';

export default class ItrOne extends React.Component<IItrOneProps, {}> {
  public render(): React.ReactElement<IItrOneProps> {
    return (
      <div className={ styles.itrOne }>
        <div className={ styles.container }>
          <div className={ styles.row }>
            <div className={ styles.column }>
              <span className={ styles.title }>Welcome to SharePoint!</span>
              <p className={ styles.subTitle }>Customize SharePoint experiences using Web Parts.</p>
              <p className={ styles.description }>{escape(this.props.description)}</p>
              <a href="https://aka.ms/spfx" className={ styles.button }>
                <span className={ styles.label }>Learn more</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
