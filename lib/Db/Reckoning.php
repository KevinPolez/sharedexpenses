<?php
/**
 * @copyright Copyright (c) 2018 Kevin Polez <kevin@hypatie.xyz>
 *
 * @author Kevin Polez <kevin@hypatie.xyz>
 *
 * @license GNU AGPL version 3 or any later version
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\SharedExpenses\Db;

use JsonSerializable;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\AppFramework\Db\Entity;

class Reckoning extends Entity implements JsonSerializable {

    protected $modified;
    protected $title;
    //protected $hash;
    protected $description;
    protected $owner;
    protected $created;
    protected $lines;

    function __contruct() {
      parent::__construct();
      $this->addType('modified', 'integer');
      $this->lines = array();
    }

    function __construct($content)
    {
       $this->setId($content['id']);
       $this->setTitle($content['title']);
       $this->setModified($content['modified']);
       $this->setDescription($content['description']);
       $this->setCreated($content['created']);
       $this->setOwner($content['owner']);
       $this->setLines($content['lines']);
    }

    /**
     * @param File $file
     * @return static
     */
    public static function fromFile(File $file, Folder $reckoningsFolder, $tags=[]){
        return new static(json_decode($file->getContent(), true));
    }

    private static function convertEncoding($str) {
        if(!mb_check_encoding($str, 'UTF-8')) {
            $str = mb_convert_encoding($str, 'UTF-8');
        }
        return $str;
    }

    public function jsonSerialize() {
        // workarround for a new reckoning (we don't want send null value, but an empty array)
        if ( $this->lines === null ) $this->lines = array();

        // date format
        //this->created = date('Ymd H:i:s', $this->created);
        return [
            'id' => $this->id,
            'title' => $this->title,
            'owner' => $this->owner,
            'created' => $this->created,
            'modified' => $this->modified,
            'description' => $this->description,
            'lines' => $this->lines
        ];
    }

    public function addLine(Line $line) {
      $this->lines[] = $line;
    }
}